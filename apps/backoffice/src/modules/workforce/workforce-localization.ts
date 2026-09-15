import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

const workforceCopy: Record<string, { id: string; en: string }> = {
  Position: { id: 'Jabatan', en: 'Position' },
  Positions: { id: 'Jabatan', en: 'Positions' },
  Attendance: { id: 'Absensi', en: 'Attendance' },
  'Attendance Report': { id: 'Laporan absensi', en: 'Attendance report' },
  'Attendance activity': { id: 'Aktivitas absensi', en: 'Attendance activity' },
  'Export CSV': { id: 'Ekspor CSV', en: 'Export CSV' },
  'Total Records': { id: 'Total catatan', en: 'Total records' },
  'Present Count': { id: 'Jumlah hadir', en: 'Present count' },
  'Absent Count': { id: 'Jumlah tidak hadir', en: 'Absent count' },
  'Leave Count': { id: 'Jumlah izin', en: 'Leave count' },
  'Sick Count': { id: 'Jumlah sakit', en: 'Sick count' },
  'Attendance Date': { id: 'Tanggal absensi', en: 'Attendance date' },
  'Check In': { id: 'Jam masuk', en: 'Check in' },
  'Check Out': { id: 'Jam pulang', en: 'Check out' },
  'Search employee code or name': {
    id: 'Cari kode atau nama karyawan',
    en: 'Search employee code or name',
  },
  'Search employee code or name...': {
    id: 'Cari kode atau nama karyawan...',
    en: 'Search employee code or name...',
  },
  'Employee profile': { id: 'Profil karyawan', en: 'Employee profile' },
  'Employment information': { id: 'Informasi kepegawaian', en: 'Employment information' },
  'Lifecycle history': { id: 'Riwayat status', en: 'Status history' },
  'Attendance summary': { id: 'Ringkasan absensi', en: 'Attendance summary' },
  'Attendance history': { id: 'Riwayat absensi', en: 'Attendance history' },
  'Status changes remain auditable and do not remove historical employee references.': {
    id: 'Perubahan status tetap tersimpan dalam riwayat.',
    en: 'Status changes remain in history.',
  },
  'System information': { id: 'Informasi data', en: 'Record information' },
  'Record version': { id: 'Versi data', en: 'Record version' },
  'Position not set': { id: 'Jabatan belum diatur', en: 'Position not set' },
  'Service assignment': { id: 'Penugasan layanan', en: 'Service assignment' },
  'Can perform services': { id: 'Dapat mengerjakan layanan', en: 'Can perform services' },
  'Cannot perform services': { id: 'Tidak dapat mengerjakan layanan', en: 'Cannot perform services' },
  'Allow employees in this position to be assigned to service work.': {
    id: 'Izinkan karyawan dengan jabatan ini mengerjakan layanan.',
    en: 'Allow employees in this position to perform services.',
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
  'Could not save position.': {
    id: 'Jabatan tidak dapat disimpan.',
    en: 'Could not save position.',
  },
  'Deactivate position': { id: 'Nonaktifkan jabatan', en: 'Deactivate position' },
  'Reactivate position': { id: 'Aktifkan kembali jabatan', en: 'Reactivate position' },
  'Existing historical assignments remain unchanged. New service assignments require an active eligible position.':
    {
      id: 'Penugasan lama tetap tersimpan. Penugasan baru memerlukan jabatan aktif yang sesuai.',
      en: 'Previous assignments remain in history. New assignments require an eligible active position.',
    },
  'Select position': { id: 'Pilih jabatan', en: 'Select position' },
  'All positions': { id: 'Semua jabatan', en: 'All positions' },
  'Attendance date': { id: 'Tanggal absensi', en: 'Attendance date' },
  Present: { id: 'Hadir', en: 'Present' },
  Absent: { id: 'Tidak hadir', en: 'Absent' },
  Leave: { id: 'Izin', en: 'Leave' },
  Sick: { id: 'Sakit', en: 'Sick' },
  'Record attendance': { id: 'Catat absensi', en: 'Record attendance' },
  'Edit attendance': { id: 'Ubah absensi', en: 'Edit attendance' },
  'Adjust attendance': { id: 'Penyesuaian absensi', en: 'Adjust attendance' },
  'Select one or more employees, then apply the same attendance adjustment.': {
    id: 'Pilih karyawan lalu terapkan penyesuaian yang sama.',
    en: 'Select employees and apply the same adjustment.',
  },
  'Select visible': { id: 'Pilih yang tampil', en: 'Select visible' },
  'Clear selection': { id: 'Hapus pilihan', en: 'Clear selection' },
  'employees selected': { id: 'karyawan dipilih', en: 'employees selected' },
  'employees updated': { id: 'karyawan diperbarui', en: 'employees updated' },
  'Attendance adjustment saved.': {
    id: 'Penyesuaian absensi disimpan.',
    en: 'Attendance adjustment saved.',
  },
  'attendance records': { id: 'catatan absensi', en: 'attendance records' },
  'Saving...': { id: 'Menyimpan...', en: 'Saving...' },
  'Attendance status': { id: 'Status absensi', en: 'Attendance status' },
  'Check in': { id: 'Jam masuk', en: 'Check in' },
  'Check out': { id: 'Jam pulang', en: 'Check out' },
  'Check in (optional)': { id: 'Jam masuk (opsional)', en: 'Check in (optional)' },
  'Check out (optional)': { id: 'Jam pulang (opsional)', en: 'Check out (optional)' },
  'Check-in and check-out times are optional for now.': {
    id: 'Jam masuk dan pulang bersifat opsional.',
    en: 'Check-in and check-out times are optional.',
  },
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
  'Attendance is recorded by authorized supervisors or managers. HRIS-sourced records remain read-only locally.':
    {
      id: 'Absensi dapat diubah oleh pengguna yang berwenang. Data dari HRIS hanya dapat dilihat.',
      en: 'Authorized users can update attendance. HRIS records are read-only.',
    },
  'Review the daily roster, find an employee quickly, and record attendance without leaving this view.':
    {
      id: 'Lihat daftar karyawan dan catat absensi harian.',
      en: 'Review employees and record daily attendance.',
    },
  'Review attendance history by day, month, or a custom date range.': {
    id: 'Lihat riwayat absensi berdasarkan periode.',
    en: 'Review attendance history by period.',
  },
  'Showing attendance records for the selected period and filters.': {
    id: 'Menampilkan absensi sesuai periode dan filter.',
    en: 'Showing attendance for the selected period and filters.',
  },
  Period: { id: 'Periode', en: 'Period' },
  Daily: { id: 'Harian', en: 'Daily' },
  Monthly: { id: 'Bulanan', en: 'Monthly' },
  Month: { id: 'Bulan', en: 'Month' },
  'Date range': { id: 'Rentang tanggal', en: 'Date range' },
  'From date': { id: 'Dari tanggal', en: 'From date' },
  'To date': { id: 'Sampai tanggal', en: 'To date' },
  Employee: { id: 'Karyawan', en: 'Employee' },
  'All employees': { id: 'Semua karyawan', en: 'All employees' },
  'All statuses': { id: 'Semua status', en: 'All statuses' },
  'Reset filters': { id: 'Reset filter', en: 'Reset filters' },
  'This month': { id: 'Bulan ini', en: 'This month' },
  'No attendance history is available.': {
    id: 'Belum ada riwayat absensi.',
    en: 'No attendance history is available.',
  },
  'Could not load attendance history.': {
    id: 'Riwayat absensi tidak dapat dimuat.',
    en: 'Could not load attendance history.',
  },
  'Service assignment eligibility is controlled by the employee position.': {
    id: 'Penugasan layanan mengikuti jabatan karyawan.',
    en: 'Service assignment follows the employee position.',
  },
};

export function useWorkforceLocalization() {
  const localization = useBackofficeLocalization();
  const copy = (value: string) =>
    workforceCopy[value]?.[localization.locale] ?? localization.copy(value);
  return { ...localization, copy };
}
