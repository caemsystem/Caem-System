import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, ArrowLeft, GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';

export default function RegisterSelection() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <Link to="/login" className="inline-flex items-center gap-2 text-gray-500 hover:text-blue-600 font-medium mb-8 transition-colors">
          <ArrowLeft size={20} />
          Kembali ke Login
        </Link>

        <div className="text-center mb-12">
          <img 
            src="https://lh3.googleusercontent.com/d/1W2PxoxVqazsPJY9Ej3DawsZZLqs0lBZc?t=1" 
            alt="CAEM Logo" 
            className="h-24 w-auto mx-auto mb-6"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">Pendaftaran CAEM</h1>
          <p className="text-gray-500 text-lg">Pilih jenis pendaftaran yang sesuai dengan kebutuhan Anda.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Peserta Option */}
          <motion.div
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center text-center group"
          >
            <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
              <GraduationCap size={40} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Daftar Sebagai Peserta</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Daftarkan diri Anda atau anak Anda untuk belajar di salah satu cabang lembaga bimbel CAEM.
            </p>
            <Link
              to="/register-peserta"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-purple-100 transition-all flex items-center justify-center gap-2"
            >
              Daftar Peserta
            </Link>
          </motion.div>

          {/* Cabang Option */}
          <motion.div
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center text-center group"
          >
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <Building2 size={40} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Daftar Sebagai Cabang</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Ingin membuka lembaga bimbel CAEM di wilayah Anda? Daftarkan cabang baru Anda di sini.
            </p>
            <Link
              to="/register-cabang"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2"
            >
              Daftar Cabang
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
