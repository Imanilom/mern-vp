#!/bin/bash
# ============================================================
#  uninstall-systemd-timers.sh
#  Hapus semua systemd timer MERN VP dari VPS
#
#  Usage:
#    sudo bash api/systemd/uninstall-systemd-timers.sh
# ============================================================

set -e

echo "============================================="
echo " MERN VP - Menghapus systemd timer units"
echo "============================================="

systemctl stop  mern-pipeline-layer2.timer  2>/dev/null || true
systemctl stop  mern-pipeline-layer3.timer  2>/dev/null || true
systemctl disable mern-pipeline-layer2.timer 2>/dev/null || true
systemctl disable mern-pipeline-layer3.timer 2>/dev/null || true

rm -f /etc/systemd/system/mern-pipeline-layer2.service
rm -f /etc/systemd/system/mern-pipeline-layer2.timer
rm -f /etc/systemd/system/mern-pipeline-layer3.service
rm -f /etc/systemd/system/mern-pipeline-layer3.timer

systemctl daemon-reload
echo " ✅ Semua unit timer dihapus."
