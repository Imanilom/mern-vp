#!/bin/bash
# ============================================================
#  install-systemd-timers.sh
#  Jalankan script ini di VPS sebagai root setelah `docker compose up`
#
#  Usage:
#    chmod +x api/systemd/install-systemd-timers.sh
#    sudo bash api/systemd/install-systemd-timers.sh
# ============================================================

set -e

SYSTEMD_DIR="/etc/systemd/system"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================="
echo " MERN VP - Memasang systemd timer units"
echo "============================================="

# Salin unit files ke /etc/systemd/system/
echo "[1/5] Menyalin unit files..."
cp "$SCRIPT_DIR/mern-pipeline-layer2.service" "$SYSTEMD_DIR/"
cp "$SCRIPT_DIR/mern-pipeline-layer2.timer"   "$SYSTEMD_DIR/"
cp "$SCRIPT_DIR/mern-pipeline-layer3.service" "$SYSTEMD_DIR/"
cp "$SCRIPT_DIR/mern-pipeline-layer3.timer"   "$SYSTEMD_DIR/"
echo "      ✓ Unit files disalin ke $SYSTEMD_DIR"

# Reload daemon systemd
echo "[2/5] Reload systemd daemon..."
systemctl daemon-reload
echo "      ✓ Daemon di-reload"

# Aktifkan timer agar auto-start saat reboot
echo "[3/5] Mengaktifkan timer (enable)..."
systemctl enable mern-pipeline-layer2.timer
systemctl enable mern-pipeline-layer3.timer
echo "      ✓ Timer diaktifkan"

# Mulai timer sekarang juga
echo "[4/5] Memulai timer..."
systemctl start mern-pipeline-layer2.timer
systemctl start mern-pipeline-layer3.timer
echo "      ✓ Timer berjalan"

# Tampilkan status
echo ""
echo "[5/5] Status timer:"
systemctl list-timers --all | grep mern
echo ""
echo "============================================="
echo " ✅ Instalasi selesai!"
echo ""
echo " Perintah berguna:"
echo "   Cek status  : systemctl status mern-pipeline-layer2.timer"
echo "   Lihat log L2: journalctl -u mern-pipeline-l2 -f"
echo "   Lihat log L3: journalctl -u mern-pipeline-l3 -f"
echo "   Daftar timer: systemctl list-timers --all"
echo "   Stop timer  : systemctl stop mern-pipeline-layer2.timer"
echo "   Uninstall   : bash api/systemd/uninstall-systemd-timers.sh"
echo "============================================="
