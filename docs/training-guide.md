# Panduan Lengkap Training Model Yellow Boy Detection

Dokumen ini menjelaskan langkah-langkah lengkap untuk melatih model YOLOv8 mendeteksi Yellow Boy (endapan iron hydroxide) dari gambar.

**Estimasi waktu total**: 3-4 jam

---

## Daftar Isi

1. [Persiapan](#1-persiapan)
2. [Mengumpulkan Dataset](#2-mengumpulkan-dataset)
3. [Labeling di Roboflow](#3-labeling-di-roboflow)
4. [Training di Google Colab](#4-training-di-google-colab)
5. [Integrasi Model](#5-integrasi-model)
6. [Verifikasi](#6-verifikasi)

---

## 1. Persiapan

### Apa itu Yellow Boy?

Yellow Boy adalah endapan berwarna kuning-oranye yang terbentuk ketika air yang terkontaminasi Acid Mine Drainage (AMD) mengoksidasi besi terlarut menjadi iron hydroxide (Fe(OH)3).

### Karakteristik Visual

| Ciri | Deskripsi |
|------|-----------|
| Warna | Kuning, oranye, oranye-coklat |
| Lokasi | Permukaan air, batuan di sungai, saluran drainase |
| Tekstur | Endapan, lapisan, noda pada batuan |
| RGB Signature | R: 180-220, G: 140-180, B: 60-120 |

### Yang Dibutuhkan

- [ ] Akun Google (untuk Colab)
- [ ] Akun Roboflow (gratis, roboflow.com)
- [ ] Koneksi internet stabil
- [ ] Browser modern (Chrome/Firefox)

---

## 2. Mengumpulkan Dataset

### Target Dataset

| Jenis | Jumlah | Keterangan |
|-------|--------|------------|
| Gambar positif | 50-100 | Mengandung Yellow Boy |
| Gambar negatif | 20-30 | Tidak mengandung Yellow Boy |
| **Total** | **70-130** | Minimum untuk training awal |

### Search Queries untuk Google Images

Buka Google Images dan cari dengan query berikut:

```
"acid mine drainage" yellow
"iron hydroxide" water
"yellow boy" mining
AMD precipitate
"mine drainage" orange
iron oxide stream contamination
ferric hydroxide mine water
acid mine runoff discoloration
"yellow boy" stream pollution
AMD water treatment orange
```

### Sumber Alternatif

- **USGS Photo Library**: https://library.usgs.gov/photo
- **EPA Superfund Sites**: Cari dokumentasi foto
- **Flickr**: Search "acid mine drainage"
- **Google Scholar**: Cari paper tentang AMD, lihat gambar di dalamnya

### Kriteria Gambar yang Baik

**AMBIL gambar yang:**
- [x] Menunjukkan endapan kuning/oranye di air
- [x] Resolusi minimal 640x640 pixel
- [x] Pencahayaan jelas (tidak terlalu gelap/terang)
- [x] Yellow Boy terlihat jelas
- [x] Variasi kondisi (cerah, mendung, berbagai sudut)

**JANGAN ambil gambar yang:**
- [ ] Daun kuning/oranye di air (bukan Yellow Boy)
- [ ] Pasir atau tanah berwarna kuning alami
- [ ] Lumut atau alga (hijau-kuning)
- [ ] Refleksi cahaya di air
- [ ] Karat pada pipa/struktur buatan
- [ ] Air keruh karena lumpur (bukan AMD)
- [ ] Resolusi terlalu rendah (< 200x200)
- [ ] Blur atau tidak fokus

### Cara Download Gambar

**Opsi 1: Manual**
1. Klik gambar di Google Images
2. Klik kanan → "Save image as..."
3. Simpan ke folder `dataset/positif/` atau `dataset/negatif/`

**Opsi 2: Browser Extension**
- Install "Download All Images" extension
- Buka hasil pencarian
- Download batch

### Gambar Negatif (Penting!)

Kumpulkan juga 20-30 gambar yang MIRIP tapi BUKAN Yellow Boy:

- Sungai/danau bersih normal
- Air dengan daun kuning mengapung
- Pantai dengan pasir kuning
- Kolam dengan lumut
- Area pertambangan tanpa AMD visible

Ini membantu model belajar membedakan Yellow Boy dari hal lain.

---

## 3. Labeling di Roboflow

### 3.1 Buat Akun

1. Buka https://roboflow.com
2. Klik "Sign Up Free"
3. Daftar dengan Google atau email
4. Verifikasi email

### 3.2 Buat Project

1. Klik **"Create New Project"**
2. Isi:
   - **Project Name**: `yellow-boy-detection`
   - **Project Type**: `Object Detection`
   - **What are you detecting?**: `yellow_boy`
   - **License**: Private (untuk hackathon)
3. Klik **"Create Project"**

### 3.3 Upload Gambar

1. Klik **"Upload"** atau drag-drop gambar
2. Upload semua gambar positif dan negatif
3. Tunggu upload selesai
4. Roboflow otomatis deteksi duplikat

### 3.4 Labeling

Untuk setiap gambar yang mengandung Yellow Boy:

1. Klik gambar untuk membuka editor
2. Pilih tool **"Bounding Box"** (kotak)
3. Gambar kotak di sekitar area Yellow Boy
4. Label akan otomatis `yellow_boy`
5. Klik **"Save"** atau tekan `Enter`

**Aturan Labeling:**

| Aturan | Contoh |
|--------|--------|
| Minimum size | 20x20 pixel |
| Kotak rapat | Jangan terlalu banyak background |
| Pisahkan area | Jika ada 3 patch Yellow Boy, buat 3 kotak |
| Skip jika ragu | Lebih baik tidak label daripada salah label |

**Untuk gambar negatif**: Tidak perlu dilabel (biarkan kosong)

### 3.5 Generate Dataset

1. Klik **"Generate"** di sidebar
2. Pilih pengaturan:
   - **Train/Valid/Test Split**: 70% / 20% / 10%
   - **Preprocessing**:
     - [x] Auto-Orient
     - [x] Resize: Stretch to 640x640
   - **Augmentation** (opsional tapi recommended):
     - [x] Flip: Horizontal
     - [x] Rotation: -15° to +15°
     - [x] Brightness: -15% to +15%
3. Klik **"Generate"**
4. Tunggu proses selesai

### 3.6 Export Dataset

1. Klik **"Export"**
2. Pilih Format: **YOLOv8**
3. Pilih **"download zip to computer"**
4. Download file ZIP

**Atau** copy kode untuk Colab:
```python
!pip install roboflow

from roboflow import Roboflow
rf = Roboflow(api_key="YOUR_API_KEY")
project = rf.workspace("YOUR_WORKSPACE").project("yellow-boy-detection")
dataset = project.version(1).download("yolov8")
```

---

## 4. Training di Google Colab

### 4.1 Buka Colab

Buka notebook Ultralytics:
https://colab.research.google.com/github/ultralytics/ultralytics/blob/main/examples/tutorial.ipynb

Atau buat notebook baru: https://colab.research.google.com

### 4.2 Aktifkan GPU

1. Klik **Runtime** → **Change runtime type**
2. Hardware accelerator: **T4 GPU** (gratis)
3. Klik **Save**

### 4.3 Install Dependencies

Jalankan cell ini:

```python
!pip install ultralytics roboflow
```

### 4.4 Download Dataset

**Opsi A: Via Roboflow API**

```python
from roboflow import Roboflow

# Ganti dengan API key dan workspace kamu
rf = Roboflow(api_key="YOUR_API_KEY")
project = rf.workspace("YOUR_WORKSPACE").project("yellow-boy-detection")
dataset = project.version(1).download("yolov8")
```

**Opsi B: Upload ZIP Manual**

1. Di sidebar Colab, klik icon folder
2. Klik icon upload
3. Upload file ZIP dari Roboflow
4. Extract:

```python
!unzip yellow-boy-detection.zip -d dataset
```

### 4.5 Verifikasi Dataset

```python
# Lihat struktur folder
!ls -la dataset/

# Lihat file data.yaml
!cat dataset/data.yaml
```

Output harus seperti ini:
```yaml
train: ../train/images
val: ../valid/images
test: ../test/images

nc: 1
names: ['yellow_boy']
```

### 4.6 Training

```python
from ultralytics import YOLO

# Load pretrained model
model = YOLO('yolov8n.pt')  # nano version, cepat untuk training

# Train
results = model.train(
    data='dataset/data.yaml',
    epochs=100,           # Bisa dikurangi ke 50 jika waktu terbatas
    imgsz=640,
    batch=16,             # Kurangi ke 8 jika GPU memory error
    patience=20,          # Early stopping
    save=True,
    project='yellow_boy_detection',
    name='train'
)
```

**Estimasi waktu training:**
- 50 epochs: ~30-45 menit
- 100 epochs: ~1-1.5 jam

### 4.7 Evaluasi Model

```python
# Lihat metrics
print(results.results_dict)

# Validasi
metrics = model.val()
print(f"mAP50: {metrics.box.map50}")
print(f"mAP50-95: {metrics.box.map}")
```

**Target metrics:**
- mAP50 > 0.5 (acceptable)
- mAP50 > 0.7 (good)
- mAP50 > 0.85 (excellent)

### 4.8 Test Inference

```python
# Test dengan gambar dari test set
from PIL import Image
import glob

test_images = glob.glob('dataset/test/images/*.jpg')[:3]

for img_path in test_images:
    results = model.predict(img_path, conf=0.25)
    results[0].show()  # Tampilkan hasil
```

### 4.9 Download Model

```python
# Lihat lokasi model
!ls -la yellow_boy_detection/train/weights/

# Download best.pt
from google.colab import files
files.download('yellow_boy_detection/train/weights/best.pt')
```

File `best.pt` akan terdownload ke komputer kamu.

---

## 5. Integrasi Model

### 5.1 Copy Model ke Project

```bash
# Dari folder Downloads, copy ke project
cp ~/Downloads/best.pt /path/to/aquamine/ai/models/best.pt
```

Atau drag-drop file ke folder `ai/models/` di VS Code/file explorer.

### 5.2 Verifikasi File

```bash
# Cek file ada
ls -la ai/models/
# Output harus menunjukkan best.pt dengan size ~6MB

# Cek ukuran file (harus ~5-7 MB untuk yolov8n)
du -h ai/models/best.pt
```

### 5.3 Test Loading Model

```bash
cd ai
uv run python -c "
from cv.detector import YellowBoyDetector
d = YellowBoyDetector()
print(f'Mode: {d.version}')
print(f'Is Mock: {d.is_mock}')
"
```

Output yang benar:
```
Mode: yolov8n-yellowboy-v1
Is Mock: False
```

Jika masih `mock-v1`, cek:
- File `best.pt` ada di lokasi yang benar
- Install ultralytics: `uv add ultralytics`

---

## 6. Verifikasi

### 6.1 Jalankan Backend

```bash
cd ai
uv add ultralytics  # Jika belum
uv run uvicorn main:app --reload
```

### 6.2 Jalankan Frontend

```bash
cd dashboard
npm run dev
```

### 6.3 Test di Browser

1. Buka http://localhost:3000/cv
2. Upload gambar Yellow Boy dari test set
3. Verifikasi:
   - [x] Detection muncul (bounding box)
   - [x] Confidence > 50% untuk gambar jelas
   - [x] Severity sesuai confidence

### 6.4 Test Negatif

Upload gambar yang BUKAN Yellow Boy:
- [x] Confidence harus < 30%
- [x] `detected: false` atau box sangat sedikit

### 6.5 Lanjutkan dengan AI

Setelah `best.pt` sudah ada, jalankan:

```
/start-work
```

AI akan otomatis:
1. Verifikasi model loading
2. Test dengan berbagai gambar
3. Dokumentasi hasil di `docs/cv-test-results.md`
4. Mark semua checklist complete

---

## Troubleshooting

### GPU Tidak Tersedia di Colab

- Coba lagi nanti (GPU gratis terbatas)
- Gunakan CPU (lebih lambat): hapus `device=0` dari training

### Out of Memory saat Training

```python
# Kurangi batch size
model.train(data='...', batch=8)  # atau batch=4
```

### Model Tidak Detect Apapun

- Dataset terlalu sedikit → Tambah gambar
- Label tidak akurat → Review dan perbaiki di Roboflow
- Epochs terlalu sedikit → Train lebih lama

### Confidence Terlalu Rendah

- Tambah augmentasi di Roboflow
- Train lebih lama (150-200 epochs)
- Gunakan model lebih besar: `yolov8s.pt` instead of `yolov8n.pt`

### Import Error: ultralytics

```bash
cd ai
uv add ultralytics
```

---

## Referensi

- [Ultralytics YOLOv8 Docs](https://docs.ultralytics.com/)
- [Roboflow Documentation](https://docs.roboflow.com/)
- [Google Colab](https://colab.research.google.com/)
- [Dataset Guide](./dataset-guide.md) - Detail lebih lanjut tentang Yellow Boy

---

## Checklist Ringkas

- [ ] Kumpulkan 50-100 gambar positif + 20-30 negatif
- [ ] Buat akun Roboflow
- [ ] Upload dan label gambar
- [ ] Generate dataset (70/20/10 split)
- [ ] Export format YOLOv8
- [ ] Buka Google Colab dengan GPU
- [ ] Install ultralytics
- [ ] Upload/download dataset
- [ ] Train model (50-100 epochs)
- [ ] Download `best.pt`
- [ ] Copy ke `ai/models/best.pt`
- [ ] Install ultralytics di project: `uv add ultralytics`
- [ ] Test di browser
- [ ] Jalankan `/start-work` untuk verifikasi final
