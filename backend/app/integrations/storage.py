import os
from pathlib import Path
from typing import Optional
from supabase import create_client, Client
from ..core.config import settings

'''Manages document storage operations in Supabase Storage. 
Supports uploading original PDFs, downloading files, and generating
temporary signed URLs for citation links in the frontend.'''

class SupabaseStorageService:
    def __init__(
        self, 
        supabase_url: str = settings.supabase_url, 
        supabase_key: str = settings.supabase_secret_key,
        bucket_name: str = "original-documents"):

        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SECRET_KEY must be configured in settings.")
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.bucket_name = bucket_name
        self.client: Client = create_client(supabase_url, supabase_key)

    def ensure_bucket_exists(self, is_public: bool = False):
        """Creates the storage bucket if it does not already exist."""
        try:
            buckets = self.client.storage.list_buckets()
            bucket_names = [b.name for b in buckets]
            if self.bucket_name not in bucket_names:
                self.client.storage.create_bucket(self.bucket_name, options={"public": is_public})
                print(f"[Storage] Bucket '{self.bucket_name}' created.")
        except Exception as e:
            print(f"[Storage] Note: Could not auto-create bucket: {e}")
    
    def upload_document(self, local_file_path: Path | str, remote_filename: Optional[str] = None):
        '''Uploads a local PDF to the Supabase storage bucket.
        Returns the remote storage path'''
        local_path = Path(local_file_path)
        if not local_path.exists():
            raise FileNotFoundError(f"Local file not found: {local_path}")
        target_name = remote_filename or local_path.name

        with open(local_path, "rb") as f:
            file_bytes = f.read()
        self.client.storage.from_(self.bucket_name).upload(
            path=target_name,
            file=file_bytes,
            file_options={"content-type": "application/pdf", "upsert": "true"}, ## upsert-true replaces file if re-ingested
        )
        print(f"[Storage] Uploaded '{local_path.name}' -> '{self.bucket_name}/{target_name}'")
        return target_name
    
    def download_document(self, remote_filename: str, local_destination_dir: Path | str):
        '''Downloads pdf from the bucket to a local repo'''
        dest_dir = Path(local_destination_dir)
        dest_dir.mkdir(parents=True, exist_ok=True)
        local_file = dest_dir / remote_filename

        file_bytes = self.client.storage.from_(self.bucket_name).download(remote_filename)
        with open(local_file, "wb") as f:
            f.write(file_bytes)
        return local_file
    
    def get_signed_url(self, remote_filename: str, expires_in_seconds: int = 3600) -> str:
        """
        Generates a secure, temporary pre-signed URL for viewing/downloading the PDF.
        Ideal for citation links in the UI (e.g. opens the exact PDF in browser).
        """
        res = self.client.storage.from_(self.bucket_name).create_signed_url(
            path=remote_filename,
            expires_in=expires_in_seconds,
        )
        # checks for error returned in response dict
        if isinstance(res, dict):
            if "error" in res and res["error"]:
                raise ValueError(f"Supabase Storage Error: {res.get('message', res['error'])}")
            ## extract url
            raw_url = res.get("signedURL") or res.get("signedURL")
            if raw_url:
                if raw_url.startswith("/"):
                    return f"{self.supabase_url}{raw_url}"
                return raw_url
        # Fallback if SDK returned a direct string
        if isinstance(res, str):
            if res.startswith("/"):
                return f"{self.supabase_url}{res}"
            return res
        raise ValueError(f"Unexpected response from Supabase Storage: {res}")
    
    
    def get_public_url(self, remote_filename: str) -> str:
        """
        Returns a static public URL (only works if bucket is set to public).
        """
        return self.client.storage.from_(self.bucket_name).get_public_url(remote_filename)
    

def main():
    """Manual verification script."""
    print("\nTesting Supabase Storage Connection...\n")
    if not settings.supabase_url or not settings.supabase_secret_key:
        print("!! Error: SUPABASE_URL or SUPABASE_SECRET_KEY missing in .env")
        return
    
    storage = SupabaseStorageService(bucket_name="original-documents")
    storage.ensure_bucket_exists(is_public=False)

    ## Locate local file on disk
    project_root = Path(__file__).resolve().parents[3]
    originals_dir = project_root / "data" / "originals"

    if not originals_dir.exists():
        print(f"Local directory not found: {originals_dir}")
        return
    
    # 2. Discover all PDF files
    pdf_files = sorted(list(originals_dir.glob("*.pdf")))
    print(f"\nDiscovered {len(pdf_files)} PDF files to upload in '{originals_dir}'.\n")

    # 3. Upload all files in a single pass
    success_count = 0
    for idx, pdf_path in enumerate(pdf_files, 1):
        filename = pdf_path.name
        file_size_mb = pdf_path.stat().st_size / (1024 * 1024)
        print(f"[{idx}/{len(pdf_files)}] Uploading '{filename}' ({file_size_mb:.2f} MB)...")

        try:
            storage.upload_document(local_file_path=pdf_path, remote_filename=filename)
            signed_url = storage.get_signed_url(remote_filename=filename, expires_in_seconds=300)
            print(f"       -> Uploaded! Signed URL {signed_url} verified.\n")
            success_count += 1

        except Exception as e:
            print(f"       ! Error uploading {filename}: {e}\n")

    print(f"Batch upload complete! Successfully processed {success_count}/{len(pdf_files)} documents.")
    



if __name__ == "__main__":
    main()