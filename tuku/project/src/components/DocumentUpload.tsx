import { useState, useRef } from 'react';
import { Upload, FileText, Image, Download, ExternalLink, X, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export type DocType = 'national_id' | 'lc_letter' | 'referral_letter' | 'photo';

interface DocumentUploadProps {
  label: string;
  description?: string;
  required?: boolean;
  currentUrl?: string;
  docType: DocType;
  userId: string;
  onUpload: (url: string) => void;
  onRemove?: () => void;
}

export function DocumentUpload({
  label, description, required, currentUrl, docType, userId, onUpload, onRemove,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPdf = (url?: string) => url?.toLowerCase().includes('.pdf') || url?.endsWith('pdf');
  const isImage = (url?: string) => !isPdf(url) && !!url;

  async function handleFile(file: File) {
    setError('');
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 10 MB.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const path = `${userId}/${docType}/${Date.now()}.${ext}`;

    setUploading(true);
    const { data, error: uploadError } = await supabase.storage
      .from('driver-docs')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('driver-docs').getPublicUrl(data.path);
    setUploading(false);

    // Local preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    onUpload(urlData.publicUrl);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const displayUrl = preview || currentUrl;
  const hasDoc = !!currentUrl;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[#4e5d70] text-sm font-medium flex items-center gap-1.5">
          {hasDoc
            ? <CheckCircle size={14} className="text-[#128663]" />
            : <FileText size={14} className="text-[#a0aec0]" />}
          {label}
          {required && <span className="text-[#e54848]">*</span>}
        </label>
        {hasDoc && onRemove && (
          <button onClick={onRemove} className="text-[#a0aec0] hover:text-[#e54848] transition-colors p-1">
            <X size={14} />
          </button>
        )}
      </div>

      {description && (
        <p className="text-[#718096] text-xs leading-relaxed">{description}</p>
      )}

      {/* Existing document display */}
      {hasDoc && (
        <div className="rounded-xl border border-[#e6edf2] overflow-hidden bg-[#f7fafc]">
          {isImage(currentUrl) ? (
            <div className="relative">
              <img
                src={displayUrl ?? ''}
                alt={label}
                className="w-full object-contain max-h-64 bg-white"
                loading="lazy"
                style={{ minHeight: '120px' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/50">
                <a href={currentUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#128663] text-white rounded-lg text-sm font-medium">
                  <ExternalLink size={14} /> View Full
                </a>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-[#e8fbf3] border border-[#a7e3d0] flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-[#128663]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#152238] text-sm font-medium truncate">Document uploaded</p>
                <p className="text-[#718096] text-xs">PDF file</p>
              </div>
            </div>
          )}
          <div className="flex gap-2 p-3 border-t border-[#e6edf2]">
            <a href={currentUrl} target="_blank" rel="noopener noreferrer" download
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#e8fbf3] hover:bg-[#d5f5e8] border border-[#a7e3d0] text-[#128663] rounded-lg text-xs font-medium transition-all">
              <Download size={13} /> Download
            </a>
            <a href={currentUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#f1f6fa] hover:bg-[#e6edf2] text-[#4e5d70] rounded-lg text-xs font-medium transition-all">
              <ExternalLink size={13} /> Open
            </a>
          </div>
        </div>
      )}

      {/* Upload area */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
          uploading
            ? 'border-[#128663]/40 bg-[#e8fbf3]/50'
            : 'border-[#e6edf2] hover:border-[#128663]/60 hover:bg-[#f7fafc] bg-white'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,application/pdf"
          onChange={onInputChange}
          className="hidden"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="text-[#128663] animate-spin" />
            <p className="text-[#128663] text-sm">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-3">
              <Image size={20} className="text-[#a0aec0]" />
              <Upload size={20} className="text-[#128663]" />
              <FileText size={20} className="text-[#a0aec0]" />
            </div>
            <p className="text-[#718096] text-sm">{hasDoc ? 'Replace document' : 'Click or drag to upload'}</p>
            <p className="text-[#a0aec0] text-xs">JPG, PNG, WEBP, HEIC or PDF — max 10 MB</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[#e54848] text-xs flex items-center gap-1">
          <X size={12} /> {error}
        </p>
      )}
    </div>
  );
}
