import { useState, type FormEvent } from "react";
import { SampleNotice } from "./SampleNotice";

/** Use case "Upload EJ" (extends Upload EJ Parsing). Placeholder: the file is not sent anywhere. */
export function UploadEjPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(
      file
        ? `Simulasi: ${file.name} (${Math.ceil(file.size / 1024)} KB) siap di-parsing, tetapi belum dikirim ke server.`
        : "Pilih file EJ terlebih dahulu.",
    );
  }

  return (
    <>
      <SampleNotice>Halaman placeholder. File tidak diunggah ke server.</SampleNotice>
      <form className="card form" onSubmit={handleSubmit}>
        <label>
          File EJ (.txt / .jrn)
          <input
            type="file"
            accept=".txt,.jrn,.log"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setMessage(null);
            }}
          />
        </label>
        <button type="submit" className="primary">
          Upload EJ
        </button>
        {message && <p role="status" className="info">{message}</p>}
      </form>
    </>
  );
}
