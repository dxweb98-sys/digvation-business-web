import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

const workforceCopy: Record<string, { id: string; en: string }> = {
  Position: { id: 'Jabatan', en: 'Position' },
  Positions: { id: 'Jabatan', en: 'Positions' },
  Attendance: { id: 'Absensi', en: 'Attendance' },
  'Employee profile': { id: 'Profil karyawan', en: 'Employee profile' },
  'Employment information': { id: 'Informasi kepegawaian', en: 'Employment information' },
  'Lifecycle history': { id: 'Riwayat status', en: 'Lifecycle history' },
  'Attendance summary': { id: 'Ringkasan absensi', en: 'Attendance summary' },
  'Attendance history': { id: 'Riwayat absensi', en: 'Attendance history' },
  'Status changes remain auditable and do not remove historical employee references.': {
    id: 'Perubahan status tetap dapat diaudit dan tidak menghapus referensi historis karyawan.',
    en: 'Status changes remain auditable and do not remove historical employee references.',
  },
  'System information': { id: 'Informasi sistem', en: 'System information' },
  'Record version': { id: 'Versi data', en: 'Record version' },
  'Position not set': { id: 'Jabatan belum diatur', en: 'Position not set' },
  'Service assignment': { id: 'Penugasan jasa', en: 'Service assignment' },
  'Can perform services': { id: 'Bisa mengerjakan jasa', en: 'Can perform services' },
  'Cannot perform services': { id: 'Tidak bisa mengerjakan jasa', en: 'Cannot perform services' },
  'Allow employees in this position to be assigned to service work.': {
    id: 'Izinkan karyawan dengan jabatan ini ditugaskan untuk mengerjakan jasa.',
    en: 'Allow employees in this position to be assigned to service work.',
  },
  'Add position': { id: 'Tambah jabatan', en: 'Add position' },
  'Edit position': { id: 'Ubah jabatan', en: 'Edit position' },
  'Position code': { id: 'Kode jabatan', en: 'Position code' },
  'Position name': { id: 'Nama jabatan', en: 'Position name' },
  'Search position code or name...': {
    id: 'Cari kode atau nama jabatan...',
    en: 'Search position code or name...',
  },
  'No positions are available.': { id: 'Belum ada jabatan.', en: 'No positions are available.' },
  'No matching positions found.': {
    id: 'Tidak ada jabatan yang sesuai.',
    en: 'No matching positions found.',
  },
  'Position added.': { id: 'Jabatan ditambahkan.', en: 'Position added.' },
  'Position updated.': { id: 'Jabatan diperbarui.', en: 'Position updated.' },
  'Could not save position.': { id: 'Jabatan tidak dapat disimpan.', en: 'Could not save position.' },
  'Deactivate position': { id: 'Nonaktifkan jabatan', en: 'Deactivate position' },
  'Reactivate position': { id: 'Aktifkan kembali jabatan', en: 'Reactivate position' },
  'Existing historical assignments remain unchanged. New service assignments require an active eligible position.': {
    id: 'Penugasan historis tetap tidak berubah. Penugasan jasa baru memerlukan jabatan aktif yang diizinkan.',
    en: 'Existing historical assignments remain unchanged. New service assignments require an active eligible position.',
  },
  'Select position': { id: 'Pilih jabatan', en: 'Select position' },
  'Attendance date': { id: 'Tanggal absensi', en: 'Attendance date' },
  Present: { id: 'Hadir', en: 'Present' },
  Absent: { id: 'Tidak hadir', en: 'Absent' },
  Leave: { id: 'Izin', en: 'Leave' },
  Sick: { id: 'Sakit', en: 'Sick' },
  'Record attendance': { id: 'Catat absensi', en: 'Record attendance' },
  'Edit attendance': { id: 'Ubah absensi', en: 'Edit attendance' },
  'Attendance status': { id: 'Status absensi', en: 'Attendance status' },
  'Check in': { id: 'Jam masuk', en: 'Check in' },
  'Check out': { id: 'Jam pulang', en: 'Check out' },
  Note: { id: 'Catatan', en: 'Note' },
  Source: { id: 'Sumber', en: 'Source' },
  Local: { id: 'Lokal', en: 'Local' },
  HRIS: { id: 'HRIS', en: 'HRIS' },
  'Recorded by': { id: 'Dicatat oleh', en: 'Recorded by' },
  'Attendance saved.': { id: 'Absensi disimpan.', en: 'Attendance saved.' },
  'Could not save attendance.': {
    id: 'Absensi tidak dapat disimpan.',
    en: 'Could not save attendance.',
  },
  'No attendance has been recorded for this date.': {
    id: 'Belum ada absensi untuk tanggal ini.',
    en: 'No attendance has been recorded for this date.',
  },
  'Attendance is recorded by authorized supervisors or managers. HRIS-sourced records remain read-only locally.': {
    id: 'Absensi dicatat oleh atasan yang berwenang. Data yang bersumber dari HRIS tetap hanya-baca secara lokal.',
    en: 'Attendance is recorded by authorized supervisors or managers. HRIS-sourced records remain read-only locally.',
  },
  'This month': { id: 'Bulan ini', en: 'This month' },
  'No attendance history is available.': {
    id: 'Belum ada riwayat absensi.',
    en: 'No attendance history is available.',
  },
  'Service eligibility is controlled by the employee position. Catalog service assignment mode still decides whether assignment is optional or required.': {
    id: 'Kelayakan mengerjakan jasa dikontrol oleh jabatan karyawan. Mode penugasan pada katalog jasa tetap menentukan apakah penugasan opsional atau wajib.',
    en: 'Service eligibility is controlled by the employee position. Catalog service assignment mode still decides whether assignment is optional or required.',
  },
};

export function useWorkforceLocalization() {
  const localization = useBackofficeLocalization();
  const copy = (value: string) =>
    workforceCopy[value]?.[localization.locale] ?? localization.copy(value);
  return { ...localization, copy };
}
