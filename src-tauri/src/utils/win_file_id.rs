//! Stable file identity on NTFS.
//!
//! Windows exposes a 128-bit id per file (`FILE_ID_INFO`), which survives
//! renaming and moving within the same volume. It is only unique per volume,
//! so it is stored next to `file_path`, never as a replacement for it.

/// Uppercase hex of the file's 128-bit id, e.g.
/// `0000000000000000A1B2C3D4E5F60718`.
///
/// Returns `None` on non-Windows targets, and on Windows when the path cannot
/// be opened or the volume has no file ids (FAT32, some network shares).
#[cfg(target_os = "windows")]
pub fn get_file_id(path: &str) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, FileIdInfo, GetFileInformationByHandleEx, FILE_FLAG_BACKUP_SEMANTICS,
        FILE_ID_INFO, FILE_ID_128, FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ,
        FILE_SHARE_WRITE, OPEN_EXISTING,
    };

    // CreateFileW wants a NUL-terminated UTF-16 string.
    let wide: Vec<u16> = std::ffi::OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    // SAFETY: `wide` is NUL-terminated and outlives the call. Null security
    // attributes and template handle are valid for OPEN_EXISTING.
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            FILE_READ_ATTRIBUTES,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            std::ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return None;
    }

    let mut info = FILE_ID_INFO {
        VolumeSerialNumber: 0,
        FileId: FILE_ID_128 { Identifier: [0; 16] },
    };

    // SAFETY: the buffer is a correctly sized FILE_ID_INFO for FileIdInfo.
    let ok = unsafe {
        GetFileInformationByHandleEx(
            handle,
            FileIdInfo,
            &mut info as *mut FILE_ID_INFO as *mut std::ffi::c_void,
            std::mem::size_of::<FILE_ID_INFO>() as u32,
        )
    };

    // SAFETY: `handle` came from CreateFileW and is closed exactly once here.
    unsafe { CloseHandle(handle) };

    if ok == 0 {
        return None;
    }

    Some(
        info.FileId
            .Identifier
            .iter()
            .map(|byte| format!("{byte:02X}"))
            .collect(),
    )
}

#[cfg(not(target_os = "windows"))]
pub fn get_file_id(_path: &str) -> Option<String> {
    None
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    #[test]
    fn reads_a_stable_uppercase_hex_id() {
        let path = std::env::temp_dir().join(format!(
            "transreader-file-id-{}.txt",
            uuid::Uuid::new_v4()
        ));
        std::fs::write(&path, b"probe").unwrap();
        let path = path.to_string_lossy().to_string();

        let first = super::get_file_id(&path);
        let second = super::get_file_id(&path);
        let _ = std::fs::remove_file(&path);

        let id = first.expect("NTFS volumes report a file id");
        assert_eq!(id.len(), 32, "128 bits as 32 hex chars");
        assert!(id.chars().all(|c| c.is_ascii_hexdigit()));
        assert!(id.chars().all(|c| !c.is_ascii_lowercase()), "hex is uppercase");
        assert_eq!(Some(id), second, "same file must give the same id");
    }

    #[test]
    fn missing_file_has_no_id() {
        assert_eq!(super::get_file_id("C:/transreader/definitely-not-here.pdf"), None);
    }
}
