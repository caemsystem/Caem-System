export type UserRole = 'admin' | 'bendahara' | 'cabang';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
  cabangId?: string;
  status?: 'pending' | 'aktif' | 'rejected';
  createdAt: string;
}

export interface Cabang {
  id: string;
  namaCabang: string;
  alamat: string;
  namaKepala: string;
  noHp: string;
  email: string;
  ktpUrl?: string;
  fotoUrl?: string;
  buktiBayarUrl?: string;
  status: 'pending' | 'aktif' | 'rejected';
  noRegistrasi?: string;
  nominalPendaftaran?: number;
  nominalDibayar?: number;
  metodePembayaran?: 'lunas' | 'cicil';
  statusPembayaran?: 'lunas' | 'belum_lunas';
  createdAt: string;
  approvedAt?: string;
}

export interface Peserta {
  id: string;
  nama: string;
  dataDiri: {
    alamat?: string;
    tanggalLahir?: string;
    noHp?: string;
    email?: string;
  };
  cabangId: string; // 'pusat' or cabangId
  nominalPendaftaran?: number;
  buktiBayarUrl?: string;
  statusPembayaran?: 'lunas' | 'belum_lunas';
  status?: 'pending' | 'aktif' | 'rejected' | 'alumni';
  createdAt: string;
}

export interface Transaksi {
  id: string;
  pesertaId?: string;
  cabangId: string;
  nominal: number;
  porsiPusat: number;
  porsiCabang: number;
  tipe: 'pendaftaran_peserta' | 'biaya_bulanan' | 'pendaftaran_cabang' | 'pemasukan' | 'pengeluaran';
  status: 'paid' | 'pending' | 'lunas';
  keterangan?: string;
  tagihanId?: string;
  createdAt: string;
}

export interface ItemBiaya {
  nama: string;
  nominal: number;
  nominalPusat: number;
}

export interface BankInfo {
  namaBank: string;
  nomorRekening: string;
  namaPemilik: string;
}

export interface Pengaturan {
  biayaPendaftaranCabang: number;
  biayaPendaftaranPeserta: number;
  persentasePusat: number;
  persentaseCabang: number;
  persentaseMinimalDP?: number;
  rincianBiayaCabang?: ItemBiaya[];
  rincianBiayaPeserta?: ItemBiaya[];
  bankInfo?: BankInfo;
}

export interface Tagihan {
  id: string;
  cabangId: string;
  nominal: number;
  status: 'pending' | 'paid';
  transaksiIds: string[];
  keterangan?: string;
  buktiBayarUrl?: string;
  createdAt: any;
  paidAt?: any;
}
