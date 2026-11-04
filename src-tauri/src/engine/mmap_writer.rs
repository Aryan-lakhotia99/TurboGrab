use anyhow::{Context, Result};
use memmap2::MmapMut;
use parking_lot::RwLock;
use std::fs::{File, OpenOptions};
use std::path::Path;
use std::sync::Arc;

pub struct MmapWriter {
    file: File,
    mmap: Arc<RwLock<MmapMut>>,
    total_size: u64,
}

impl MmapWriter {
    /// Create or open a file, pre-allocate disk blocks to prevent fragmentation,
    /// and initialize zero-copy memory mapping.
    pub fn new(path: &Path, total_size: u64) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create directories for {:?}", path))?;
        }

        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(path)
            .with_context(|| format!("Failed to open destination file {:?}", path))?;

        // 1. Sparse Pre-Allocation: Reserve disk blocks instantly
        Self::preallocate(&file, total_size)
            .with_context(|| format!("Failed to preallocate {} bytes", total_size))?;

        // 2. Set file length to ensure valid bounds
        file.set_len(total_size)
            .with_context(|| format!("Failed to set file length to {}", total_size))?;

        // 3. Zero-Copy Memory Map
        let mmap = unsafe {
            memmap2::MmapOptions::new()
                .len(total_size as usize)
                .map_mut(&file)
                .with_context(|| "Failed to memory-map target file")?
        };

        Ok(Self {
            file,
            mmap: Arc::new(RwLock::new(mmap)),
            total_size,
        })
    }

    /// Pre-allocates contiguous disk blocks using OS-level system calls
    #[cfg(windows)]
    fn preallocate(file: &File, size: u64) -> Result<()> {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::Foundation::HANDLE;
        use windows_sys::Win32::Storage::FileSystem::{
            FileAllocationInfo, SetFileInformationByHandle, FILE_ALLOCATION_INFO,
        };

        let handle = file.as_raw_handle() as HANDLE;
        let mut alloc_info = FILE_ALLOCATION_INFO {
            AllocationSize: size as i64,
        };

        let result = unsafe {
            SetFileInformationByHandle(
                handle,
                FileAllocationInfo,
                &mut alloc_info as *mut _ as *mut _,
                std::mem::size_of::<FILE_ALLOCATION_INFO>() as u32,
            )
        };

        if result == 0 {
            // Fallback to standard truncation if special allocation not supported
            file.set_len(size)?;
        }
        Ok(())
    }

    #[cfg(unix)]
    fn preallocate(file: &File, size: u64) -> Result<()> {
        use std::os::unix::io::AsRawFd;
        let fd = file.as_raw_fd();
        let ret = unsafe { libc::posix_fallocate(fd, 0, size as libc::off_t) };
        if ret != 0 {
            file.set_len(size)?;
        }
        Ok(())
    }

    #[cfg(not(any(windows, unix)))]
    fn preallocate(file: &File, size: u64) -> Result<()> {
        file.set_len(size)?;
        Ok(())
    }

    /// Zero-Copy write slice directly to memory mapped page
    pub fn write_at(&self, offset: u64, buf: &[u8]) -> Result<()> {
        let len = buf.len();
        if offset + len as u64 > self.total_size {
            anyhow::bail!(
                "Write out of bounds: offset {} + len {} exceeds total size {}",
                offset,
                len,
                self.total_size
            );
        }

        let mut mmap = self.mmap.write();
        let start = offset as usize;
        let end = start + len;
        mmap[start..end].copy_from_slice(buf);
        Ok(())
    }

    /// Flush mapped pages to physical storage
    pub fn flush_range(&self, offset: u64, len: usize) -> Result<()> {
        let mmap = self.mmap.read();
        mmap.flush_range(offset as usize, len)
            .context("Failed to flush memory-mapped range")?;
        Ok(())
    }

    /// Flush all pages
    pub fn flush(&self) -> Result<()> {
        let mmap = self.mmap.read();
        mmap.flush().context("Failed to flush entire memory map")?;
        Ok(())
    }

    pub fn total_size(&self) -> u64 {
        self.total_size
    }
}
