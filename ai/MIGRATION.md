# Database Migration Setup

Tim AquaMine sekarang menggunakan **Alembic** untuk database migrations. Ini memastikan schema database selalu sinkron dengan SQLAlchemy models.

## Untuk Tim (Pengguna)

### Setup Pertama Kali

```bash
# 1. Rebuild container untuk install alembic
docker compose down
docker compose build --no-cache api

# 2. Start services
docker compose up -d

# 3. Migration akan otomatis berjalan saat container start
# Cek logs untuk memastikan
docker compose logs api | grep -i "migration"
```

### Update Schema (Ketika Pull Changes)

```bash
# Restart api container - migration otomatis berjalan
docker compose restart api

# Atau rebuild jika ada dependency baru
docker compose build api
docker compose up -d
```

### Troubleshooting

#### Error: column does not exist

Jika ada error seperti `column chat_session_segments.created_at does not exist`:

```bash
# Force run migration manually
docker compose exec api bash
cd /app/ai
alembic upgrade head
```

#### Reset Database (Hati-hati! Data akan hilang)

```bash
docker compose down -v  # Hapus volume
docker compose up -d db # Start DB baru
docker compose up -d api # Migration akan run otomatis
```

## Untuk Developer (Yang Modify Models)

### Menambah/Mengubah Model

1. **Ubah model** di `ai/db/models.py`

2. **Generate migration**:
   ```bash
   docker compose exec api bash
   cd /app/ai
   alembic revision --autogenerate -m "Deskripsi perubahan"
   ```

3. **Review migration file** yang dibuat di `ai/alembic/versions/`

4. **Test migration**:
   ```bash
   alembic upgrade head
   ```

5. **Commit migration file** ke git

### Struktur Migration

```
ai/
├── alembic/
│   ├── versions/
│   │   ├── 001_add_chat_missing_columns.py  # Migration contoh
│   │   └── ...
│   ├── env.py
│   └── script.py.mako
└── alembic.ini
```

### Command Berguna

```bash
# Check current version
alembic current

# History
alembic history

# Downgrade 1 version
alembic downgrade -1

# Upgrade ke latest
alembic upgrade head

# Check sql yang akan dijalankan (dry run)
alembic upgrade head --sql
```

## Teknis Detail

- **Migration Table**: `alembic_version` (dibuat otomatis)
- **First Migration**: `001_add_chat_missing_columns` - menambah kolom `created_at` yang hilang di chat tables
- **Entrypoint**: Otomatis run `alembic upgrade head` saat container start
- **Idempotent**: Migration bisa di-run berkali-kali tanpa error (menggunakan `IF NOT EXISTS`)

## Catatan

- Migration di-run otomatis via `entrypoint.sh` sebelum FastAPI start
- Jika migration gagal, container akan tetap start tapi dengan warning
- Selalu commit file migration baru ke repository
- Test migration di local sebelum push
