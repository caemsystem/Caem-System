import { useEffect, useState } from 'react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Transaksi, Cabang } from '../types';
import { handleFirestoreError, OperationType, formatDate, toISODate } from '../lib/firestore-utils';
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  FileSpreadsheet, 
  File as FilePdf,
  Search,
  Building2,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface LaporanPageProps {
  user: UserProfile;
}

export default function LaporanPage({ user }: LaporanPageProps) {
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterCabang, setFilterCabang] = useState('all');

  if (user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Akses Ditolak</h2>
          <p className="text-gray-500 text-sm">Halaman ini hanya dapat diakses oleh Admin Utama.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const txQuery = query(collection(db, 'transaksi'), orderBy('createdAt', 'desc'));
      const txSnap = await getDocs(txQuery);
      setTransactions(txSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaksi)));

      const cSnap = await getDocs(collection(db, 'cabang'));
      setCabangList(cSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Cabang)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'laporan_data');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const txDate = toISODate(tx.createdAt);
    const matchesStart = !dateRange.start || txDate >= dateRange.start;
    const matchesEnd = !dateRange.end || txDate <= dateRange.end;
    const matchesCabang = filterCabang === 'all' || tx.cabangId === filterCabang;
    return matchesStart && matchesEnd && matchesCabang;
  });

  const totalPusat = filteredTransactions.reduce((acc, tx) => acc + tx.porsiPusat, 0);
  const totalCabang = filteredTransactions.reduce((acc, tx) => acc + tx.porsiCabang, 0);
  const totalNominal = filteredTransactions.reduce((acc, tx) => acc + tx.nominal, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const exportToPDF = () => {
    const doc = new jsPDF() as any;
    doc.text('Laporan Keuangan CAEM', 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${dateRange.start || 'Semua'} s/d ${dateRange.end || 'Semua'}`, 14, 22);
    
    const tableData = filteredTransactions.map(tx => [
      formatDate(tx.createdAt),
      tx.tipe.replace('_', ' '),
      tx.cabangId === 'pusat' ? 'Pusat' : (cabangList.find(c => c.id === tx.cabangId)?.namaCabang || 'Cabang'),
      formatCurrency(tx.nominal),
      formatCurrency(tx.porsiPusat),
      formatCurrency(tx.porsiCabang)
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Tanggal', 'Tipe', 'Cabang', 'Total', 'Pusat', 'Cabang']],
      body: tableData,
    });

    doc.save(`Laporan_CAEM_${new Date().getTime()}.pdf`);
  };

  const exportToExcel = () => {
    const data = filteredTransactions.map(tx => ({
      Tanggal: formatDate(tx.createdAt),
      Tipe: tx.tipe.replace('_', ' '),
      Cabang: tx.cabangId === 'pusat' ? 'Pusat' : (cabangList.find(c => c.id === tx.cabangId)?.namaCabang || 'Cabang'),
      Total: tx.nominal,
      PorsiPusat: tx.porsiPusat,
      PorsiCabang: tx.porsiCabang,
      Status: tx.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
    XLSX.writeFile(wb, `Laporan_CAEM_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="space-y-8">
      {/* Filters & Actions */}
      <div className="bg-white p-5 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-6">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Mulai Tanggal</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Sampai Tanggal</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                />
              </div>
            </div>
          </div>

          <div className="w-full lg:w-64">
            <label className="block text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Filter Cabang</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={filterCabang}
                onChange={e => setFilterCabang(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium appearance-none"
              >
                <option value="all">Semua Cabang</option>
                <option value="pusat">Pusat</option>
                {cabangList.map(c => <option key={c.id} value={c.id}>{c.namaCabang}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={exportToPDF}
              className="flex-1 lg:flex-none px-6 py-3 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <FilePdf size={18} />
              PDF
            </button>
            <button 
              onClick={exportToExcel}
              className="flex-1 lg:flex-none px-6 py-3 bg-green-50 text-green-600 font-bold rounded-2xl hover:bg-green-100 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Report Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
            <p className="text-sm font-bold text-gray-500">Total Pemasukan</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalNominal)}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><DollarSign size={20} /></div>
            <p className="text-sm font-bold text-gray-500">Porsi Pusat</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalPusat)}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><DollarSign size={20} /></div>
            <p className="text-sm font-bold text-gray-500">Porsi Cabang</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalCabang)}</h3>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Detail Laporan</h3>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
            <FileText size={14} />
            <span>{filteredTransactions.length} Transaksi</span>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Keterangan</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cabang</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Pusat</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cabang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [1, 2, 3].map(i => <tr key={i} className="animate-pulse h-16"><td colSpan={6} className="px-6" /></tr>)
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(tx.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900 capitalize">{tx.tipe.replace('_', ' ')}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tx.cabangId === 'pusat' ? 'Pusat' : (cabangList.find(c => c.id === tx.cabangId)?.namaCabang || 'Cabang')}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatCurrency(tx.nominal)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">{formatCurrency(tx.porsiPusat)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-green-600">{formatCurrency(tx.porsiCabang)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Tidak ada data untuk periode ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-50">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="p-6 animate-pulse space-y-4">
                <div className="h-4 bg-gray-100 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))
          ) : filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx) => (
              <div key={tx.id} className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900 capitalize">{tx.tipe.replace('_', ' ')}</p>
                    <p className="text-[10px] text-gray-500">{formatDate(tx.createdAt)}</p>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{formatCurrency(tx.nominal)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Building2 size={12} />
                    <span>{tx.cabangId === 'pusat' ? 'Pusat' : (cabangList.find(c => c.id === tx.cabangId)?.namaCabang || 'Cabang')}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-blue-600">P: {formatCurrency(tx.porsiPusat)}</span>
                    <span className="text-green-600">C: {formatCurrency(tx.porsiCabang)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-gray-400 text-sm">Tidak ada data untuk periode ini.</div>
          )}
        </div>
      </div>
    </div>
  );
}
