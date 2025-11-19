#set page(
  paper: "a4",
  margin: (x: 2.5cm, y: 2.5cm),
)

#set text(
  font: "New Computer Modern",
  size: 11pt,
  lang: "id"
)

#set par(
  justify: true,
  leading: 0.65em
)

#set heading(numbering: "1.")

// --- HEADER IDENTITAS ---
#align(center)[
  #text(16pt, weight: "bold")[Laporan Implementasi File Upload]
  #v(1em)
  #text(12pt)[
    *Nama:* Fakhri Abraar Wiryadisastra \
    *NRP:* 5025231201
  ]
]

#line(length: 100%)
#v(1em)

// --- ISI LAPORAN ---

= Implementasi Backend (S3 / MinIO)

Pada bagian backend yang menggunakan protokol S3, implementasi utama dilakukan pada modul `S3Module` dan `S3Service`. Backend tidak menerima file secara langsung, melainkan bertugas sebagai koordinator keamanan.

*Implementasi yang dilakukan:*
- **S3 Service Configuration:** Menginisialisasi `S3Client` dari AWS SDK v3. Konfigurasi disesuaikan agar mendukung MinIO (S3-compatible storage) dengan menambahkan opsi `forcePathStyle: true` dan menggunakan endpoint lokal.
`this.s3Client = new S3Client({
  region: configService.get('AWS_REGION'),
  credentials: {
    accessKeyId: configService.get('AWS_ACCESS_KEY_ID'),
    secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY'),
  },
  // Penting untuk MinIO:
  endpoint: configService.get('AWS_S3_ENDPOINT'), 
  forcePathStyle: true, 
});`

`async generatePresignedUrl(fileExtension: string, contentType: string) {
  const imagePath = ``posts/${randomUUID()}.${fileExtension}``;
  const command = new PutObjectCommand({
    Bucket: this.BUCKET_NAME,
    Key: imagePath,
    ContentType: contentType,
  });
  // Menghasilkan URL yang valid selama 1 jam untuk method PUT
  const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  return { uploadUrl, imagePath };
}`
- **Presigned URL Generation:** Membuat method `generatePresignedUrl` yang menggunakan perintah `PutObjectCommand`.
- **Controller Endpoint:** Mengekspos endpoint `POST /s3/presigned-url` yang dilindungi oleh `JwtAuthGuard`.

*Fungsi:*
1.  **Keamanan:** Memastikan hanya pengguna yang terautentikasi yang bisa mendapatkan izin untuk mengunggah file.
2.  **Efisiensi Server:** Backend tidak perlu memproses aliran data (stream) file yang berat, sehingga menghemat RAM dan CPU server aplikasi.
3.  **Delegasi Upload:** Memberikan URL sementara yang aman kepada klien agar klien dapat mengunggah file langsung ke *Object Storage*.

= Implementasi Frontend (S3)

Pada sisi frontend untuk skenario S3, logika pengunggahan dibagi menjadi dua tahap utama untuk memastikan keamanan dan keberhasilan penyimpanan data.

*Implementasi yang dilakukan:*
- **Request Presigned URL:** Mengirim request ke backend untuk mendapatkan URL upload yang valid.
- **Direct Upload (PUT):** Menggunakan URL yang didapat untuk mengirim file gambar secara langsung ke MinIO/S3 menggunakan method `PUT` dengan header `Content-Type` yang sesuai.
- **Post Creation:** Setelah upload berhasil, frontend mengirimkan *path* (kunci file) ke backend untuk disimpan di database bersamaan dengan konten teks.

*Fungsi:*
1.  **Mengurangi Latency:** Mengunggah file langsung ke server penyimpanan (Storage) tanpa harus melewati server aplikasi (Backend API).
2.  **Validasi Awal:** Memastikan file berhasil terunggah ke penyimpanan sebelum membuat data postingan di database.

= Implementasi Backend (Multer)

Pada backend yang menggunakan Multer, server aplikasi bertindak sebagai penerima dan penyimpan file secara langsung pada disk lokal server.

*Implementasi yang dilakukan:*
- **FileInterceptor:** Menggunakan interceptor pada controller untuk menangkap file dari request `multipart/form-data`.
`const presignedResponse = await fetch('http://localhost:3000/s3/presigned-url', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ fileExtension: 'jpg', contentType: 'image/jpeg' }),
});
const { uploadUrl, imagePath } = await presignedResponse.json();`

- **Validasi File (Filter & Limits):** Menambahkan logika `fileFilter` untuk memastikan hanya file gambar (jpg, png, gif, webp) yang diterima, serta membatasi ukuran file maksimal 5MB.
`await fetch(uploadUrl, {
  method: 'PUT', // Method PUT wajib untuk S3 Presigned URL
  body: imageFile, // File biner mentah
  headers: { 'Content-Type': imageFile.type },
});`
- **Disk Storage:** Mengkonfigurasi `diskStorage` untuk menyimpan file di folder `./uploads` dan memberikan nama unik menggunakan *timestamp* dan bilangan acak.
- **Static Asset Serving:** Mengaktifkan `ServeStaticModule` agar file yang tersimpan di folder lokal dapat diakses melalui URL HTTP.

*Fungsi:*
1.  **Kontrol Penuh:** Backend memiliki kendali penuh atas file sebelum disimpan (validasi tipe, ukuran, dan penamaan).
2.  **Kesederhanaan:** Tidak memerlukan layanan pihak ketiga atau server *object storage* terpisah. File disimpan langsung di *file system* server.

= Implementasi Frontend (Multer)

Frontend untuk skenario Multer menggunakan pendekatan pengiriman formulir standar (`FormData`) yang umum digunakan dalam aplikasi web.

*Implementasi yang dilakukan:*
- **FormData Object:** Membungkus file gambar yang dipilih pengguna ke dalam objek `FormData`.
- **Upload Request:** Mengirimkan `FormData` tersebut ke endpoint `/upload` pada backend. Browser secara otomatis mengatur header `Content-Type` menjadi `multipart/form-data`.
- **Handling Response:** Menerima nama file (`imagePath`) dari respon backend dan menggunakannya untuk membuat postingan baru.

*Fungsi:*
1.  **Kemudahan Pengiriman:** Memanfaatkan standar browser native untuk pengiriman file biner.
2.  **Integrasi Langsung:** Mengirim file langsung ke server aplikasi tempat logika bisnis berada.

= Perbandingan: S3 vs. Multer

== Analisis Multer (Local Storage)

Pada metode ini, file diunggah langsung ke server backend dan disimpan di *disk* lokal server tersebut. Backend bertanggung jawab penuh untuk memproses *stream* file .

=== Kelebihan
- **Implementasi Sederhana:** Mudah dipelajari dan dikonfigurasi, sangat cocok untuk tahap pengembangan awal[cite: 441, 445].
- **Tidak Ada Ketergantungan Eksternal:** Tidak memerlukan layanan tambahan atau akun *cloud* pihak ketiga[cite: 442].
- **Kontrol Penuh:** Pengembang memiliki kendali penuh atas validasi dan penanganan file di dalam kode aplikasi[cite: 443].
- **Efisien untuk File Kecil:** Sangat cepat untuk menangani file berukuran kecil karena tidak ada latensi jaringan ke layanan eksternal[cite: 444].

=== Kekurangan
- **Keterbatasan Penyimpanan:** Kapasitas penyimpanan terbatas pada *disk* server fisik tempat aplikasi berjalan[cite: 447].
- **Isu Skalabilitas (*Scaling*):** Sulit diterapkan pada arsitektur *multi-server* karena file tersimpan di satu server saja, sehingga server lain tidak dapat mengaksesnya tanpa *shared storage* yang kompleks[cite: 448, 726].
- **Beban Backend:** Proses upload membebani CPU, RAM, dan *bandwidth* server aplikasi utama, yang dapat menyebabkan *bottleneck* saat trafik tinggi[cite: 449, 702].

== Analisis S3 (Object Storage / Presigned URLs)

Metode ini mengubah paradigma dengan membiarkan klien mengunggah file langsung ke layanan penyimpanan (seperti AWS S3 atau MinIO) menggunakan URL sementara yang dibuat oleh backend [cite: 149-153].

=== Kelebihan
- **Skalabilitas Tinggi:** Penyimpanan tidak terbatas dan tidak bergantung pada disk server aplikasi[cite: 548].
- **Efisiensi Bandwidth:** Beban lalu lintas upload ditangani langsung oleh penyedia *storage*, sehingga server backend tetap ringan[cite: 549].
- **Mendukung CDN:** Memiliki integrasi bawaan dengan *Content Delivery Network* (seperti CloudFront) untuk distribusi konten global yang cepat[cite: 550].
- **Keamanan & Durabilitas:** Menyediakan fitur *backup*, *versioning*, dan redundansi data yang lebih baik[cite: 551, 553].

=== Kekurangan
- **Kompleksitas Setup:** Memerlukan konfigurasi awal yang lebih rumit (Bucket policy, CORS, IAM Roles) dibandingkan Multer[cite: 556].
- **Biaya:** Jika menggunakan layanan *cloud* seperti AWS, terdapat biaya berdasarkan penggunaan (penyimpanan & transfer data)[cite: 555].
- **Ketergantungan Eksternal:** Sangat bergantung pada penyedia layanan pihak ketiga[cite: 557].

== Perbandingan Langsung

#figure(
  table(
    columns: (auto, 1fr, 1fr),
    inset: 10pt,
    align: horizon,
    fill: (_, row) => if calc.odd(row) { luma(240) } else { white },
    [*Aspek*], [*Multer*], [*S3 / MinIO*],
    [Lokasi Simpan], [Disk Lokal Server], [Cloud / Self-hosted Server],
    [Beban Backend], [Tinggi (Menangani stream)], [Rendah (Hanya tanda tangan)],
    [Skalabilitas], [Terbatas (Vertical Scaling)], [Tak Terbatas (Horizontal)],
    [Biaya Awal], [Rendah], [Menengah (Butuh akun/setup)],
    [Setup], [Mudah], [Kompleks],
  ),
  caption: [Tabel Perbandingan Multer vs S3]
)

= Kesimpulan: Mana yang Lebih Baik?

Pemilihan metode terbaik bergantung sepenuhnya pada kebutuhan proyek, skala trafik, dan sumber daya yang tersedia[cite: 856]:

1.  **Gunakan Multer Jika:**
    -   Anda sedang membangun aplikasi kecil, *prototype*.
    -   Aplikasi bersifat internal (Intranet) dengan trafik rendah.
    -   Anggaran sangat terbatas dan ingin menghindari biaya layanan *cloud*.

2.  **Gunakan S3 / MinIO Jika:**
    -   Anda membangun aplikasi produksi berskala besar (SaaS, Media Sosial, E-commerce).
    -   Aplikasi memproses banyak media (foto/video) dan membutuhkan CDN.
    -   Anda membutuhkan arsitektur yang *stateless* agar mudah di-*scale* secara horizontal[cite: 788].

*Kesimpulan:*
Untuk pembelajaran, mulailah dengan **Multer** karena kesederhanaannya. Namun, untuk aplikasi produksi modern, disarankan menggunakan arsitektur **S3 (atau MinIO untuk self-hosted)**. Pola terbaik adalah merancang abstraksi kode agar aplikasi dapat beralih antar kedua metode ini dengan mudah sesuai lingkungan (*environment*) yang digunakan .