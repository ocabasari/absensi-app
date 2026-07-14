"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function AbsensiApp() {
  const [role, setRole] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [location, setLocation] = useState<string>("Mendeteksi lokasi otomatis...");
  const [distance, setDistance] = useState<number | null>(null);
  const [isValidLocation, setIsValidLocation] = useState<boolean>(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [userSummary, setUserSummary] = useState<any[]>([]);
  
  const [usersList, setUsersList] = useState<any[]>([]);
  const [pelatihList, setPelatihList] = useState<any[]>([]);

  // State untuk Tab Navigasi Dashboard (supaya tidak menumpuk di HP)
  const [activeTab, setActiveTab] = useState<string>("absen");

  // State untuk Input Login Auth
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // State untuk Filter Rentang Tanggal
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // State Filter & Search untuk Daftar Hadir
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // State Filter & Search untuk Daftar Pengguna (Admin)
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");

  // State Filter & Search untuk Rekap Total Kehadiran
  const [summaryRoleFilter, setSummaryRoleFilter] = useState<string>("all");
  const [summarySearchQuery, setSummarySearchQuery] = useState<string>("");

  // State untuk Selected ID Approval/Delete Massal (Checkbox)
  const [selectedAttendanceIds, setSelectedAttendanceIds] = useState<number[]>([]);

  // State untuk Edit User
  const [editingUser, setEditingUser] = useState<any>(null);

  const [adminLat, setAdminLat] = useState<number>(-6.31505);
  const [adminLng, setAdminLng] = useState<number>(107.34449);
  const [maxRadiusMeters, setMaxRadiusMeters] = useState<number>(100);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchUsers();

    // Cek sesi aktif Supabase Auth saat refresh
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (userData) {
          setCurrentUser(userData);
          setRole(userData.role);
        }
      }
    });
  }, []);

  // Otomatis ambil lokasi & nyalakan kamera saat masuk ke halaman form absen
  useEffect(() => {
    if (role === "atlet_form" || role === "absen_pelatih" || role === "pelatih_form") {
      getLocation();
      startCamera();
    }
  }, [role, adminLat, adminLng]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', loginEmail)
          .single();

        if (userError || !userData) {
          alert("Profil pengguna tidak ditemukan di database!");
          return;
        }

        setCurrentUser(userData);
        setRole(userData.role);
      }
    } catch (error: any) {
      alert("Gagal masuk: " + error.message);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (data) {
        setAdminLat(data.latitude);
        setAdminLng(data.longitude);
        setMaxRadiusMeters(data.radius_meters);
      }
    } catch {
      console.log("Menggunakan default setting lokasi.");
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*');
    if (data) {
      setUsersList(data);
      setPelatihList(data.filter((u: any) => u.role === 'pelatih'));
    }
  };

  const handleCreateOrUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const nama = (form.elements.namedItem('nama') as HTMLInputElement).value;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const userRole = (form.elements.namedItem('role') as HTMLSelectElement).value;
    const coachId = (form.elements.namedItem('coach_id') as HTMLSelectElement)?.value || null;

    try {
      if (editingUser) {
        const payload = {
          nama,
          email,
          role: userRole,
          coach_id: userRole === 'atlet' && coachId ? parseInt(coachId) : null,
        };
        const { error } = await supabase.from('users').update(payload).eq('id', editingUser.id);
        if (error) throw error;
        alert("Data user berhasil diperbarui!");
        setEditingUser(null);
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;

        const payload = {
          nama,
          email,
          role: userRole,
          coach_id: userRole === 'atlet' && coachId ? parseInt(coachId) : null,
        };
        const { error: dbError } = await supabase.from('users').insert([payload]);
        if (dbError) throw dbError;

        alert("User baru berhasil didaftarkan dan terhubung ke Auth!");
      }
      form.reset();
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      alert("Gagal memproses user: " + error.message);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (confirm("Yakin ingin menghapus user ini?")) {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) {
        alert("Gagal menghapus: " + error.message);
      } else {
        alert("User berhasil dihapus.");
        fetchUsers();
      }
    }
  };

  const handleDeleteAttendance = async (id: number) => {
    if (confirm("Yakin ingin menghapus data absensi ini?")) {
      const { error } = await supabase.from('attendances').delete().eq('id', id);
      if (error) {
        alert("Gagal menghapus absen: " + error.message);
      } else {
        alert("Data absensi berhasil dihapus.");
        fetchAttendances();
      }
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const lat = parseFloat((form.elements.namedItem('lat') as HTMLInputElement).value);
    const lng = parseFloat((form.elements.namedItem('lng') as HTMLInputElement).value);
    const radius = parseInt((form.elements.namedItem('radius') as HTMLInputElement).value);

    const { error } = await supabase.from('settings').upsert([
      { id: 1, latitude: lat, longitude: lng, radius_meters: radius }
    ]);

    if (error) {
      alert("Gagal menyimpan pengaturan: " + error.message);
    } else {
      setAdminLat(lat);
      setAdminLng(lng);
      setMaxRadiusMeters(radius);
      alert("Pengaturan radius berhasil diperbarui!");
    }
  };

  useEffect(() => {
    if (role) {
      fetchAttendances();
    }
  }, [role, currentUser, startDate, endDate, summaryRoleFilter]);

  const fetchAttendances = async () => {
    try {
      const { data, error } = await supabase
        .from('attendances')
        .select('*, users!attendances_user_id_fkey(id, nama, role, coach_id)')
        .order('id', { ascending: false });

      if (error) throw error;

      if (data) {
        let filtered = data;

        if (role === "pelatih" && currentUser) {
          filtered = data.filter((item: any) => 
            item.user_id === currentUser.id || item.coach_id === currentUser.id
          );
        }

        if ((role as string) === "atlet" && currentUser) {
          filtered = data.filter((item: any) => item.user_id === currentUser.id);
        }

        if (startDate && endDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          filtered = filtered.filter((item: any) => {
            const itemDate = new Date(item.created_at || item.tanggal);
            return itemDate >= start && itemDate <= end;
          });
        }

        const formattedHistory = filtered.map((item: any) => ({
          id: item.id,
          nama: item.users?.nama || 'Pengguna',
          original_role: item.users?.role ? String(item.users.role).toLowerCase().trim() : 'atlet',
          role: item.status_radius === 'dalam_radius' ? `${item.status_approval === 'approved' ? 'terverifikasi (approved)' : 'pending approval'}` : 'diluar radius',
          waktu: item.waktu,
          tanggal: item.tanggal,
          location: `${item.latitude}, ${item.longitude}`,
          photo: item.photo_url,
          signature: item.signature_url,
          status_approval: item.status_approval,
          user_id: item.user_id,
          coach_id: item.coach_id,
        }));
        setHistory(formattedHistory);

        // Rekapitulasi Kehadiran dengan Pemetaan yang Bersih
        const summaryMap: { [key: string]: { total: number; role: string } } = {};
        filtered.forEach((item: any) => {
          const name = item.users?.nama || 'Pengguna';
          const uRole = item.users?.role ? String(item.users.role).toLowerCase().trim() : 'atlet';
          
          if (item.status_radius === 'dalam_radius' && item.status_approval === 'approved') {
            if (!summaryMap[name]) {
              summaryMap[name] = { total: 0, role: uRole };
            }
            summaryMap[name].total += 1;
          }
        });

        const summaryArray = Object.keys(summaryMap)
          .filter((nama) => {
            if (summaryRoleFilter === "all") return true;
            return summaryMap[nama].role.toLowerCase() === summaryRoleFilter.toLowerCase();
          })
          .map((nama) => ({
            nama,
            role: summaryMap[nama].role,
            totalHadir: summaryMap[nama].total,
          }));

        setUserSummary(summaryArray);
      }
    } catch (error: any) {
      console.error("Gagal memuat rekap absen:", error.message);
    }
  };

  const handleApprove = async (id: number) => {
    const { error } = await supabase.from('attendances').update({ status_approval: 'approved' }).eq('id', id);
    if (error) {
      alert("Gagal approve: " + error.message);
    } else {
      alert("Absen berhasil disetujui!");
      fetchAttendances();
    }
  };

  // Fungsi Approve Massal (Bulk Approve)
  const handleBulkApprove = async () => {
    if (selectedAttendanceIds.length === 0) {
      alert("Pilih minimal satu data kehadiran untuk disetujui.");
      return;
    }
    if (confirm(`Setujui ${selectedAttendanceIds.length} data absensi yang dipilih?`)) {
      const { error } = await supabase
        .from('attendances')
        .update({ status_approval: 'approved' })
        .in('id', selectedAttendanceIds);

      if (error) {
        alert("Gagal approve massal: " + error.message);
      } else {
        alert("Absen terpilih berhasil disetujui secara massal!");
        setSelectedAttendanceIds([]);
        fetchAttendances();
      }
    }
  };

  // Fungsi Hapus Massal (Bulk Delete)
  const handleBulkDelete = async () => {
    if (selectedAttendanceIds.length === 0) {
      alert("Pilih minimal satu data kehadiran untuk dihapus.");
      return;
    }
    if (confirm(`Yakin ingin menghapus ${selectedAttendanceIds.length} data absensi yang dipilih?`)) {
      const { error } = await supabase
        .from('attendances')
        .delete()
        .in('id', selectedAttendanceIds);

      if (error) {
        alert("Gagal menghapus massal: " + error.message);
      } else {
        alert("Data absensi terpilih berhasil dihapus secara massal!");
        setSelectedAttendanceIds([]);
        fetchAttendances();
      }
    }
  };

  const toggleSelectAll = (filteredHistoryList: any[]) => {
    const allIds = filteredHistoryList.map(i => i.id);
    if (selectedAttendanceIds.length === allIds.length) {
      setSelectedAttendanceIds([]);
    } else {
      setSelectedAttendanceIds(allIds);
    }
  };

  const toggleSelectId = (id: number) => {
    if (selectedAttendanceIds.includes(id)) {
      setSelectedAttendanceIds(selectedAttendanceIds.filter(item => item !== id));
    } else {
      setSelectedAttendanceIds([...selectedAttendanceIds, id]);
    }
  };

  const compressImage = (dataUrl: string, quality: number = 0.7, maxWidth: number = 600): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(dataUrl);
        }
      };
    });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          const dist = calculateDistance(lat, lng, adminLat, adminLng);
          setDistance(Math.round(dist));
          setIsValidLocation(dist <= maxRadiusMeters);
        },
        () => {
          setLocation("Gagal mendeteksi lokasi");
          setIsValidLocation(false);
        }
      );
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      alert("Tidak dapat mengakses kamera");
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const width = videoRef.current.videoWidth;
      const height = videoRef.current.videoHeight;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, width, height);
        setPhoto(canvasRef.current.toDataURL("image/png"));
      }
    }
  };

  useEffect(() => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
  }, [role]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.beginPath();
    setSignature(canvas.toDataURL("image/png"));
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    let x = 'clientX' in e ? e.clientX - rect.left : (e.touches && e.touches[0] ? e.touches[0].clientX - rect.left : 0);
    let y = 'clientX' in e ? e.clientY - rect.top : (e.touches && e.touches[0] ? e.touches[0].clientY - rect.top : 0);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    setSignature(null);
  };

  const handleKirimAbsen = async () => {
    if (!role || !currentUser) return;
    
    try {
      let photoUrl = null;
      let signatureUrl = null;

      if (photo) {
        const compressedPhoto = await compressImage(photo, 0.7, 600);
        const res = await fetch(compressedPhoto);
        const blob = await res.blob();
        const fileName = `photo_${Date.now()}.jpg`;
        const { data, error } = await supabase.storage.from('absensi-files').upload(fileName, blob);
        if (error) throw error;
        const { data: publicUrlData } = supabase.storage.from('absensi-files').getPublicUrl(data.path);
        photoUrl = publicUrlData.publicUrl;
      }

      if (signature) {
        const compressedSig = await compressImage(signature, 0.8, 500);
        const res = await fetch(compressedSig);
        const blob = await res.blob();
        const fileName = `sig_${Date.now()}.jpg`;
        const { data, error } = await supabase.storage.from('absensi-files').upload(fileName, blob);
        if (error) throw error;
        const { data: publicUrlData } = supabase.storage.from('absensi-files').getPublicUrl(data.path);
        signatureUrl = publicUrlData.publicUrl;
      }

      const isPelatih = role === 'absen_pelatih';
      const { error: dbError } = await supabase.from('attendances').insert([
        {
          user_id: currentUser.id,
          coach_id: currentUser.coach_id || (isPelatih ? currentUser.id : null),
          tanggal: new Date().toLocaleDateString(),
          waktu: new Date().toLocaleTimeString(),
          latitude: parseFloat(location.split(',')[0]) || 0,
          longitude: parseFloat(location.split(',')[1]) || 0,
          status_radius: isValidLocation ? 'dalam_radius' : 'diluar_radius',
          photo_url: photoUrl,
          signature_url: signatureUrl,
          status_approval: isPelatih ? 'approved' : 'pending',
        },
      ]);

      if (dbError) throw dbError;

      alert(`Absen ${currentUser.nama} berhasil dikirim!`);
      fetchAttendances();
      setRole(currentUser.role);
    } catch (error: any) {
      alert("Gagal mengirim absen: " + error.message);
    }
  };

  if (!role) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2 text-gray-800">Absensi Online</h1>
          <p className="text-sm text-gray-500 mb-6">Silakan masuk dengan akun terdaftar</p>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-3 text-left mb-6">
            <div>
              <label className="text-xs font-semibold text-gray-600">Email</label>
              <input 
                type="email" 
                value={loginEmail} 
                onChange={(e) => setLoginEmail(e.target.value)} 
                placeholder="email@instance.com" 
                className="border p-2 rounded text-xs w-full bg-white text-gray-800" 
                required 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Password</label>
              <input 
                type="password" 
                value={loginPassword} 
                onChange={(e) => setLoginPassword(e.target.value)} 
                placeholder="••••••••" 
                className="border p-2 rounded text-xs w-full bg-white text-gray-800" 
                required 
              />
            </div>
            <button type="submit" className="bg-blue-600 text-white py-2 rounded-lg font-semibold text-xs hover:bg-blue-700 mt-2">
              Masuk
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (role === "admin" || role === "pelatih" || role === "atlet") {
    const filteredHistoryList = history.filter((item) => {
      const matchSearch = item.nama.toLowerCase().includes(searchQuery.toLowerCase()) || item.location.includes(searchQuery);
      const matchRole = roleFilter === "all" || item.original_role === roleFilter;
      return matchSearch && matchRole;
    });

    const filteredSummaryList = userSummary.filter((sum) => 
      sum.nama.toLowerCase().includes(summarySearchQuery.toLowerCase())
    );

    const selectedItems = filteredHistoryList.filter(i => selectedAttendanceIds.includes(i.id));
    const hasUnapprovedSelected = selectedItems.some(i => i.status_approval !== 'approved');

    return (
      <main className="min-h-screen p-8 bg-gray-100 flex flex-col items-center">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            .print-scroll-fix {
              max-height: none !important;
              overflow-y: visible !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}} />
        <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-3xl text-gray-800">
          <button onClick={() => { setRole(null); setCurrentUser(null); }} className="text-sm text-blue-600 mb-4 font-semibold no-print">← Keluar / Ganti Akun ({currentUser?.nama})</button>
          
          <div className="flex justify-between items-center mb-4 no-print">
            <h1 className="text-xl font-bold text-gray-800 uppercase">Dashboard {role}: {currentUser?.nama}</h1>
            {role !== "atlet" && (
              <button onClick={() => window.print()} className="bg-emerald-600 text-white text-sm py-2 px-4 rounded-lg font-semibold hover:bg-emerald-700 no-print">Cetak / Simpan PDF</button>
            )}
          </div>

          {(role === "pelatih" || role === "atlet") && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-100 no-print flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-green-800">Absensi Kehadiran Latihan</h2>
                <p className="text-xs text-green-600">Lakukan absensi latihan hari ini.</p>
              </div>
              <button 
                onClick={() => setRole(role === "pelatih" ? "absen_pelatih" : "atlet_form")} 
                className="bg-green-600 text-white text-xs py-2 px-4 rounded font-semibold hover:bg-green-700"
              >
                Buka Form Absen
              </button>
            </div>
          )}

          {/* TAB NAVIGASI UTAMA (Mengatasi Tumpukan Panjang di HP) */}
          {role !== "atlet" && (
            <div className="flex border-b mb-6 no-print overflow-x-auto">
              <button 
                onClick={() => setActiveTab("absen")} 
                className={`py-2 px-4 text-xs font-bold border-b-2 whitespace-nowrap ${activeTab === "absen" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Daftar Hadir
              </button>
              <button 
                onClick={() => setActiveTab("rekap")} 
                className={`py-2 px-4 text-xs font-bold border-b-2 whitespace-nowrap ${activeTab === "rekap" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Rekap Total
              </button>
              {role === "admin" && (
                <>
                  <button 
                    onClick={() => setActiveTab("users")} 
                    className={`py-2 px-4 text-xs font-bold border-b-2 whitespace-nowrap ${activeTab === "users" ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    Kelola User
                  </button>
                  <button 
                    onClick={() => setActiveTab("settings")} 
                    className={`py-2 px-4 text-xs font-bold border-b-2 whitespace-nowrap ${activeTab === "settings" ? "border-blue-800 text-blue-800" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    Pengaturan Radius
                  </button>
                </>
              )}
            </div>
          )}

          {/* KONTEN TAB 1: DAFTAR KEHADIRAN & AKSI MASSAL */}
          {(activeTab === "absen" || role === "atlet") && (
            <div className="mt-2">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Daftar Kehadiran yang Masuk</h2>
              
              {role !== "atlet" && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 no-print flex flex-col gap-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 font-semibold">Cari Nama / Lokasi</label>
                      <input 
                        type="text" 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        placeholder="Ketik nama atlet/pelatih..." 
                        className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" 
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-semibold">Filter Peran</label>
                      <select 
                        value={roleFilter} 
                        onChange={(e) => setRoleFilter(e.target.value)} 
                        className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full"
                      >
                        <option value="all">Semua Peran</option>
                        <option value="atlet">Atlet</option>
                        <option value="pelatih">Pelatih</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <label className="text-xs text-gray-600 font-semibold">Dari Tanggal</label>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-semibold">Sampai Tanggal</label>
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" />
                    </div>
                  </div>
                  {(startDate || endDate || searchQuery || roleFilter !== "all") && (
                    <button 
                      onClick={() => { setStartDate(""); setEndDate(""); setSearchQuery(""); setRoleFilter("all"); }} 
                      className="bg-gray-500 text-white text-xs py-1 px-3 rounded font-semibold self-start mt-1"
                    >
                      Reset Filter & Pencarian
                    </button>
                  )}
                </div>
              )}

              {/* Tombol Aksi Massal Dinamis */}
              {role !== "atlet" && filteredHistoryList.length > 0 && (() => {
                const selectedItems = filteredHistoryList.filter(i => selectedAttendanceIds.includes(i.id));
                const unapprovedItems = selectedItems.filter(i => i.status_approval !== 'approved');
                
                return (
                  <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded flex justify-between items-center no-print text-xs">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-blue-900">
                      <input 
                        type="checkbox" 
                        onChange={() => toggleSelectAll(filteredHistoryList)}
                        checked={selectedAttendanceIds.length > 0 && selectedAttendanceIds.length === filteredHistoryList.length}
                      />
                      Pilih Semua
                    </label>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleBulkApprove} 
                        className="bg-blue-600 text-white py-1.5 px-3 rounded font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        disabled={unapprovedItems.length === 0}
                      >
                        Setujui Terpilih ({unapprovedItems.length})
                      </button>
                      <button 
                        onClick={handleBulkDelete} 
                        className="bg-red-600 text-white py-1.5 px-3 rounded font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        disabled={selectedAttendanceIds.length === 0}
                      >
                        Hapus Terpilih ({selectedAttendanceIds.length})
                      </button>
                    </div>
                  </div>
                );
              })()}

              {filteredHistoryList.length === 0 ? (
                <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded text-center">Belum ada data absen yang sesuai.</p>
              ) : (
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-2 print-scroll-fix">
                  {filteredHistoryList.map((item, idx) => (
                    <div key={idx} className="border p-3 rounded bg-gray-50 text-sm flex justify-between items-center text-gray-800">
                      <div className="flex items-start gap-2">
                        {role !== "atlet" && (
                          <input 
                            type="checkbox" 
                            checked={selectedAttendanceIds.includes(item.id)}
                            onChange={() => toggleSelectId(item.id)}
                            className="mt-1 no-print"
                          />
                        )}
                        <div>
                          <p className="font-bold text-gray-800 uppercase">{item.nama} - <span className="text-blue-600">{item.role}</span></p>
                          <p className="text-xs text-gray-500">{item.tanggal} - {item.waktu}</p>
                          <p className="text-xs text-gray-600">Lokasi: {item.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.photo && <img src={item.photo} alt="Bukti Foto" className="w-16 h-16 object-cover rounded border" />}
                        {item.signature && <img src={item.signature} alt="TTD Digital" className="w-24 h-16 object-contain bg-white rounded border" />}
                        
                        {role === "pelatih" && item.status_approval !== "approved" && (
                          <button onClick={() => handleApprove(item.id)} className="bg-green-600 text-white text-xs py-1.5 px-3 rounded font-semibold hover:bg-green-700 no-print">Approve</button>
                        )}
                        {role === "admin" && (
                          <button onClick={() => handleDeleteAttendance(item.id)} className="bg-red-600 text-white text-xs py-1.5 px-3 rounded font-semibold hover:bg-red-700 no-print">Hapus</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* KONTEN TAB 2: REKAP TOTAL KEHADIRAN */}
          {activeTab === "rekap" && role !== "atlet" && (
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-indigo-900">Rekap Total Kehadiran</h3>
                <select 
                  value={summaryRoleFilter} 
                  onChange={(e) => setSummaryRoleFilter(e.target.value)} 
                  className="border p-1 rounded bg-white text-gray-800 text-xs no-print"
                >
                  <option value="all">Semua Peran</option>
                  <option value="atlet">Atlet</option>
                  <option value="pelatih">Pelatih</option>
                </select>
              </div>

              <div className="mb-2 no-print">
                <input 
                  type="text" 
                  value={summarySearchQuery} 
                  onChange={(e) => setSummarySearchQuery(e.target.value)} 
                  placeholder="Cari nama pada rekap..." 
                  className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" 
                />
              </div>

              {filteredSummaryList.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Belum ada data kehadiran pada filter ini.</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                  {filteredSummaryList.map((sum, index) => (
                    <div key={index} className="flex justify-between items-center bg-white p-2 rounded border text-xs">
                      <div>
                        <span className="font-bold text-gray-800">{sum.nama}</span>
                        <span className="text-[10px] text-gray-500 uppercase ml-2">({sum.role})</span>
                      </div>
                      <span className="bg-indigo-600 text-white px-2.5 py-0.5 rounded-full font-semibold">Hadir: {sum.totalHadir}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* KONTEN TAB 3: KELOLA PENGGUNA & MANAJEMEN PENUGASAN */}
          {activeTab === "users" && role === "admin" && (
            <div className="flex flex-col gap-4">
              <form onSubmit={handleCreateOrUpdateUser} className="p-4 bg-purple-50 rounded-lg border border-purple-100 text-gray-800">
                <h2 className="text-sm font-bold text-purple-800 mb-2">
                  {editingUser ? `Edit Data User: ${editingUser.nama}` : "Tambah User Baru & Buat Akun Auth"}
                </h2>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-gray-600 font-semibold">Nama Lengkap</label>
                    <input name="nama" type="text" defaultValue={editingUser?.nama || ""} placeholder="Nama..." className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" required />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-semibold">Email</label>
                    <input name="email" type="email" defaultValue={editingUser?.email || ""} placeholder="email@..." className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" required />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-semibold">Password Akun</label>
                    <input name="password" type="password" placeholder="Minimal 6 karakter" className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" required={!editingUser} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-semibold">Role</label>
                    <select 
                      name="role" 
                      value={editingUser?.role || "atlet"} 
                      onChange={(e) => setEditingUser(editingUser ? {...editingUser, role: e.target.value} : { role: e.target.value, coach_id: "" })} 
                      className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full"
                    >
                      <option value="atlet">Atlet</option>
                      <option value="pelatih">Pelatih</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-600 font-semibold">Pelatih Pembimbing</label>
                    <select 
                      name="coach_id" 
                      value={editingUser?.coach_id || ""} 
                      onChange={(e) => setEditingUser(editingUser ? {...editingUser, coach_id: e.target.value} : { role: "atlet", coach_id: e.target.value })} 
                      className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full"
                    >
                      <option value="">-- Tanpa Pelatih / Mandiri --</option>
                      {pelatihList.map((p) => (
                        <option key={p.id} value={p.id}>{p.nama}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="submit" className="bg-purple-600 text-white text-xs py-1.5 px-3 rounded font-semibold hover:bg-purple-700">
                    {editingUser ? "Update Perubahan User" : "Daftarkan User Baru"}
                  </button>
                  {editingUser && (
                    <button type="button" onClick={() => setEditingUser(null)} className="bg-gray-500 text-white text-xs py-1.5 px-3 rounded font-semibold">Batal Edit</button>
                  )}
                </div>
              </form>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 mb-2">Daftar Pengguna & Manajemen Penugasan</h3>
                <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    value={userSearchQuery} 
                    onChange={(e) => setUserSearchQuery(e.target.value)} 
                    placeholder="Cari nama pengguna..." 
                    className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" 
                  />
                  <select 
                    value={userRoleFilter} 
                    onChange={(e) => setUserRoleFilter(e.target.value)} 
                    className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full"
                  >
                    <option value="all">Semua Role</option>
                    <option value="atlet">Atlet</option>
                    <option value="pelatih">Pelatih</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {usersList.filter((u) => {
                    const matchSearch = u.nama.toLowerCase().includes(userSearchQuery.toLowerCase()) || u.email.toLowerCase().includes(userSearchQuery.toLowerCase());
                    const matchRole = userRoleFilter === "all" || u.role === userRoleFilter;
                    return matchSearch && matchRole;
                  }).length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-2">Tidak ada pengguna yang cocok.</p>
                  ) : (
                    usersList.filter((u) => {
                      const matchSearch = u.nama.toLowerCase().includes(userSearchQuery.toLowerCase()) || u.email.toLowerCase().includes(userSearchQuery.toLowerCase());
                      const matchRole = userRoleFilter === "all" || u.role === userRoleFilter;
                      return matchSearch && matchRole;
                    }).map((u) => {
                      const coachObj = usersList.find((p) => p.id === u.coach_id);
                      return (
                        <div key={u.id} className="flex justify-between items-center bg-white p-2 border rounded text-xs">
                          <div>
                            <span className="font-bold">{u.nama}</span> ({u.role.toUpperCase()})
                            {u.role === 'atlet' && <span className="text-gray-500 ml-2">Pelatih: {coachObj?.nama || 'Mandiri'}</span>}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => setEditingUser(u)} className="bg-amber-500 text-white px-2 py-1 rounded font-semibold">Edit</button>
                            <button onClick={() => handleDeleteUser(u.id)} className="bg-red-500 text-white px-2 py-1 rounded font-semibold">Hapus</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* KONTEN TAB 4: PENGATURAN TITIK PUSAT & RADIUS */}
          {activeTab === "settings" && role === "admin" && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-gray-800">
              <form onSubmit={handleUpdateSettings}>
                <h2 className="text-sm font-bold text-blue-800 mb-2">Pengaturan Titik Pusat & Radius Absen</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                  <div>
                    <label className="text-xs text-gray-600 font-semibold">Latitude</label>
                    <input name="lat" type="number" step="any" defaultValue={adminLat} className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" required />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-semibold">Longitude</label>
                    <input name="lng" type="number" step="any" defaultValue={adminLng} className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" required />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-semibold">Radius (Meter)</label>
                    <input name="radius" type="number" defaultValue={maxRadiusMeters} className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" required />
                  </div>
                </div>
                <button type="submit" className="bg-blue-600 text-white text-xs py-1.5 px-3 rounded font-semibold hover:bg-blue-700">Simpan Pengaturan Radius</button>
              </form>
            </div>
          )}

          {/* Area Tanda Tangan Mengetahui / Pelatih - Tampil saat Cetak/Print */}
          {role !== "atlet" && (
            <div className="mt-12 pt-8 border-t flex justify-end">
              <div className="text-center w-64">
                <p className="text-xs text-gray-600 mb-1">
                  Karawang, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-sm font-bold text-gray-800">Mengetahui,</p>
                <p className="text-xs text-gray-500 mb-16">Pelatih / Pembimbing</p>
                <p className="font-bold text-sm text-gray-800 border-b border-gray-400 pb-1 inline-block min-w-[180px]">
                  {role === 'pelatih' ? currentUser?.nama : '( _________________________ )'}
                </p>
              </div>
            </div>
          )}

        </div>
      </main>
    );
  }

  // TAMPILAN FORM ABSEN (ATLET ATAU PELATIH)
  return (
    <main className="min-h-screen p-8 bg-gray-100 flex flex-col items-center">
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md text-gray-800">
        <button onClick={() => setRole(currentUser?.role || "atlet")} className="text-sm text-blue-600 mb-4 font-semibold">← Kembali</button>
        <h1 className="text-xl font-bold mb-1 text-gray-800 uppercase">Form Absen: {currentUser?.nama}</h1>
        <p className="text-xs text-gray-400 mb-4 uppercase">Peran: {currentUser?.role}</p>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1 text-gray-700">Lokasi GPS & Radius (Otomatis)</label>
          <p className="text-sm bg-gray-50 p-2 rounded mb-1 text-gray-600">{location}</p>
          {distance !== null && (
            <p className={`text-xs font-semibold mb-2 ${isValidLocation ? 'text-green-600' : 'text-red-600'}`}>
              Jarak dari lokasi admin: {distance} meter ({isValidLocation ? 'Dalam radius' : `Diluar radius ${maxRadiusMeters}m!`})
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1 text-gray-700">Foto Selfie</label>
          <div className="flex gap-2 mb-2">
            <button onClick={takePhoto} className="bg-amber-600 text-sm py-1.5 px-4 rounded font-semibold w-full text-white">Ambil Foto</button>
          </div>
          <video ref={videoRef} autoPlay playsInline className="w-full rounded bg-black h-48 object-cover mb-2"></video>
          <canvas ref={canvasRef} className="hidden"></canvas>
          {photo && <img src={photo} alt="Selfie" className="w-full rounded h-48 object-cover border mb-2" />}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1 text-gray-700">Tanda Tangan Digital</label>
          <canvas
            ref={sigCanvasRef}
            width={380}
            height={150}
            className="border rounded bg-gray-50 cursor-crosshair touch-none mb-2"
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseMove={draw}
            onTouchStart={startDrawing}
            onTouchEnd={stopDrawing}
            onTouchMove={draw}
          ></canvas>
          <button onClick={clearSignature} className="bg-red-500 text-white text-xs py-1 px-3 rounded font-semibold hover:bg-red-600">Ulangi TTD</button>
        </div>

        <button 
          disabled={!isValidLocation}
          onClick={handleKirimAbsen}
          className={`w-full py-2.5 rounded-lg font-semibold mt-4 text-white ${isValidLocation ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
        >
          {isValidLocation ? 'Kirim Absen' : 'Diluar Jangkauan Lokasi'}
        </button>
      </div>
    </main>
  );
}