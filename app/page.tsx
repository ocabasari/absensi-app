"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { 
  ClipboardDocumentListIcon, 
  UsersIcon, 
  MapPinIcon, 
  PrinterIcon, 
  CheckIcon, 
  TrashIcon, 
  PencilSquareIcon,
  CameraIcon,
  ArrowPathIcon
} from "@heroicons/react/24/solid";

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

  const [activeTab, setActiveTab] = useState<string>("absen");

  // State untuk Modal Kustom Konfirmasi Seragam
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'success' | 'warning';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {},
  });

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");

  const [summaryRoleFilter, setSummaryRoleFilter] = useState<string>("all");
  const [summarySearchQuery, setSummarySearchQuery] = useState<string>("");

  const [selectedAttendanceIds, setSelectedAttendanceIds] = useState<number[]>([]);
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

  const executeCreateOrUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
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

  const confirmSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formTarget = e.currentTarget;
    setModalConfig({
      isOpen: true,
      title: editingUser ? "Konfirmasi Update User" : "Konfirmasi Simpan User",
      message: "Apakah Anda yakin ingin menyimpan perubahan data pengguna ini?",
      type: 'warning',
      onConfirm: () => {
        executeCreateOrUpdateUser({ preventDefault: () => {} , currentTarget: formTarget } as any);
      }
    });
  };

  const handleDeleteUser = (id: number) => {
    setModalConfig({
      isOpen: true,
      title: "Hapus Pengguna",
      message: "Yakin ingin menghapus pengguna ini dari sistem?",
      type: 'danger',
      onConfirm: async () => {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) {
          alert("Gagal menghapus: " + error.message);
        } else {
          alert("User berhasil dihapus.");
          fetchUsers();
        }
      }
    });
  };

  const handleDeleteAttendance = (id: number) => {
    setModalConfig({
      isOpen: true,
      title: "Hapus Absensi",
      message: "Yakin ingin menghapus data absensi ini?",
      type: 'danger',
      onConfirm: async () => {
        const { error } = await supabase.from('attendances').delete().eq('id', id);
        if (error) {
          alert("Gagal menghapus absen: " + error.message);
        } else {
          alert("Data absensi berhasil dihapus.");
          fetchAttendances();
        }
      }
    });
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

  const handleApprove = (id: number) => {
    setModalConfig({
      isOpen: true,
      title: "Setujui Kehadiran",
      message: "Setujui data absensi latihan ini?",
      type: 'success',
      onConfirm: async () => {
        const { error } = await supabase.from('attendances').update({ status_approval: 'approved' }).eq('id', id);
        if (error) {
          alert("Gagal approve: " + error.message);
        } else {
          alert("Absen berhasil disetujui!");
          fetchAttendances();
        }
      }
    });
  };

  const handleBulkApprove = () => {
    if (selectedAttendanceIds.length === 0) {
      alert("Pilih minimal satu data kehadiran untuk disetujui.");
      return;
    }
    setModalConfig({
      isOpen: true,
      title: "Persetujuan Massal",
      message: `Setujui ${selectedAttendanceIds.length} data absensi yang dipilih?`,
      type: 'success',
      onConfirm: async () => {
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
    });
  };

  const handleBulkDelete = () => {
    if (selectedAttendanceIds.length === 0) {
      alert("Pilih minimal satu data kehadiran untuk dihapus.");
      return;
    }
    setModalConfig({
      isOpen: true,
      title: "Hapus Massal",
      message: `Yakin ingin menghapus ${selectedAttendanceIds.length} data absensi yang dipilih?`,
      type: 'danger',
      onConfirm: async () => {
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
    });
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
    setPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      alert("Tidak dapat mengakses kamera");
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const width = videoRef.current.videoWidth || 640;
      const height = videoRef.current.videoHeight || 480;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, width, height);
        const dataUrl = canvasRef.current.toDataURL("image/png");
        setPhoto(dataUrl);
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

  const executeKirimAbsen = async () => {
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

  const confirmKirimAbsen = () => {
    setModalConfig({
      isOpen: true,
      title: "Konfirmasi Kirim Absen",
      message: "Pastikan foto selfie dan tanda tangan Anda sudah benar. Kirim absensi sekarang?",
      type: 'success',
      onConfirm: executeKirimAbsen
    });
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

    return (
      <main className="min-h-screen p-4 md:p-8 bg-gray-100 flex flex-col items-center">
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
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-md w-full max-w-3xl text-gray-800">
          
          <div className="flex justify-between items-center mb-4 pb-3 border-b no-print">
            <div>
              <h1 className="text-base md:text-lg font-bold text-gray-800 uppercase">Dashboard {role}</h1>
              <p className="text-xs text-gray-500 font-medium">{currentUser?.nama}</p>
            </div>
            <button 
              onClick={() => setModalConfig({
                isOpen: true,
                title: "Konfirmasi Keluar",
                message: "Apakah Anda yakin ingin keluar dari sesi ini?",
                type: 'danger',
                onConfirm: async () => {
                  await supabase.auth.signOut(); 
                  setRole(null); 
                  setCurrentUser(null);
                }
              })} 
              className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow transition-all flex items-center gap-1"
            >
              Keluar
            </button>
          </div>
          
          <div className="flex justify-between items-center mb-3 no-print">
            <h2 className="text-xs md:text-sm font-semibold text-gray-600 uppercase">Panel Utama</h2>
            {role !== "atlet" && activeTab === "absen" && (
              <button 
                onClick={() => window.print()} 
                title="Cetak / Simpan PDF"
                className="bg-emerald-600 text-white p-2 rounded-lg font-semibold hover:bg-emerald-700 no-print flex items-center justify-center shadow"
              >
                <PrinterIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          {(role === "pelatih" || role === "atlet") && (
            <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-100 no-print flex justify-between items-center">
              <div>
                <h2 className="text-xs md:text-sm font-bold text-green-800">Absensi Kehadiran Latihan</h2>
                <p className="text-[11px] text-green-600">Lakukan absensi latihan hari ini.</p>
              </div>
              <button 
                onClick={() => setRole(role === "pelatih" ? "absen_pelatih" : "atlet_form")} 
                className="bg-green-600 text-white text-xs py-1.5 px-3 rounded font-semibold hover:bg-green-700 whitespace-nowrap"
              >
                Buka Form Absen
              </button>
            </div>
          )}

          {role !== "atlet" && (
            <div className="grid grid-cols-3 gap-2 mb-6 no-print">
              <button 
                onClick={() => setActiveTab("absen")} 
                className={`py-2.5 px-2 text-[11px] md:text-xs font-bold rounded-lg flex flex-col md:flex-row items-center justify-center gap-1 transition-all text-center ${
                  activeTab === "absen" 
                    ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-300" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                }`}
              >
                <ClipboardDocumentListIcon className="w-4 h-4" />
                <span>Daftar Hadir & Rekap</span>
              </button>
              {role === "admin" && (
                <>
                  <button 
                    onClick={() => setActiveTab("users")} 
                    className={`py-2.5 px-2 text-[11px] md:text-xs font-bold rounded-lg flex flex-col md:flex-row items-center justify-center gap-1 transition-all text-center ${
                      activeTab === "users" 
                        ? "bg-purple-600 text-white shadow-md ring-2 ring-purple-300" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                    }`}
                  >
                    <UsersIcon className="w-4 h-4" />
                    <span>Kelola User</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab("settings")} 
                    className={`py-2.5 px-2 text-[11px] md:text-xs font-bold rounded-lg flex flex-col md:flex-row items-center justify-center gap-1 transition-all text-center ${
                      activeTab === "settings" 
                        ? "bg-blue-800 text-white shadow-md ring-2 ring-blue-300" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                    }`}
                  >
                    <MapPinIcon className="w-4 h-4" />
                    <span>Pengaturan Radius</span>
                  </button>
                </>
              )}
            </div>
          )}

          {(activeTab === "absen" || role === "atlet") && (
            <div className="flex flex-col gap-6">
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-indigo-900">
                    Rekap Total Kehadiran
                  </h3>
                  {role !== "atlet" && (
                    <select 
                      value={summaryRoleFilter} 
                      onChange={(e) => setSummaryRoleFilter(e.target.value)} 
                      className="border p-1 rounded bg-white text-gray-800 text-xs no-print"
                    >
                      <option value="all">Semua Peran</option>
                      <option value="atlet">Atlet</option>
                      <option value="pelatih">Pelatih</option>
                    </select>
                  )}
                </div>

                {role !== "atlet" && (
                  <div className="mb-2 no-print">
                    <input 
                      type="text" 
                      value={summarySearchQuery} 
                      onChange={(e) => setSummarySearchQuery(e.target.value)} 
                      placeholder="Cari nama pada rekap..." 
                      className="border p-1.5 rounded bg-white text-gray-800 text-xs w-full" 
                    />
                  </div>
                )}

                {filteredSummaryList.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Belum ada data kehadiran pada filter ini.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
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

              <div>
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
                          title="Setujui Terpilih"
                          className="bg-blue-600 text-white p-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1 shadow"
                          disabled={unapprovedItems.length === 0}
                        >
                          <CheckIcon className="w-4 h-4" />
                          <span>({unapprovedItems.length})</span>
                        </button>
                        <button 
                          onClick={handleBulkDelete} 
                          title="Hapus Terpilih"
                          className="bg-red-600 text-white p-2 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1 shadow"
                          disabled={selectedAttendanceIds.length === 0}
                        >
                          <TrashIcon className="w-4 h-4" />
                          <span>({selectedAttendanceIds.length})</span>
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
                      <div key={idx} className="border p-3 rounded bg-gray-50 text-sm flex flex-wrap justify-between items-center gap-2 text-gray-800">
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
                        <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
                          {item.photo && <img src={item.photo} alt="Bukti Foto" className="w-12 h-12 md:w-16 md:h-16 object-cover rounded border" />}
                          {item.signature && <img src={item.signature} alt="TTD Digital" className="w-20 h-12 md:w-24 md:h-16 object-contain bg-white rounded border" />}
                          
                          {role === "pelatih" && item.status_approval !== "approved" && (
                            <button onClick={() => handleApprove(item.id)} title="Approve" className="bg-green-600 text-white p-2 rounded-lg font-semibold hover:bg-green-700 no-print shadow">
                              <CheckIcon className="w-4 h-4" />
                            </button>
                          )}
                          {role === "admin" && (
                            <button onClick={() => handleDeleteAttendance(item.id)} title="Hapus" className="bg-red-600 text-white p-2 rounded-lg font-semibold hover:bg-red-700 no-print shadow">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {role !== "atlet" && (
                <div className="mt-12 pt-8 border-t hidden print:flex justify-end">
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
          )}

          {activeTab === "users" && role === "admin" && (
            <div className="flex flex-col gap-4">
              <form onSubmit={confirmSaveUser} className="p-4 bg-purple-50 rounded-lg border border-purple-100 text-gray-800">
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
                      defaultValue={editingUser?.role || "atlet"} 
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
                      defaultValue={editingUser?.coach_id || ""} 
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
                            <button onClick={() => setEditingUser(u)} title="Edit" className="bg-amber-500 text-white p-1.5 rounded font-semibold shadow">
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteUser(u.id)} title="Hapus" className="bg-red-500 text-white p-1.5 rounded font-semibold shadow">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && role === "admin" && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-gray-800">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formTarget = e.currentTarget;
                setModalConfig({
                  isOpen: true,
                  title: "Simpan Pengaturan",
                  message: "Simpan perubahan radius dan titik koordinat pusat absen?",
                  type: 'warning',
                  onConfirm: () => handleUpdateSettings({ preventDefault: () => {}, currentTarget: formTarget } as any)
                });
              }}>
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

        </div>

        {/* MODAL KONFIRMASI KUSTOM SERAGAM */}
        {modalConfig.isOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center transform transition-all animate-in fade-in zoom-in-95">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                modalConfig.type === 'danger' ? 'bg-red-100 text-red-500' :
                modalConfig.type === 'success' ? 'bg-green-100 text-green-500' : 'bg-amber-100 text-amber-500'
              }`}>
                {modalConfig.type === 'danger' ? <TrashIcon className="w-6 h-6" /> :
                 modalConfig.type === 'success' ? <CheckIcon className="w-6 h-6" /> : <PencilSquareIcon className="w-6 h-6" />}
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">{modalConfig.title}</h3>
              <p className="text-xs text-gray-500 mb-6">{modalConfig.message}</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2.5 rounded-xl transition"
                >
                  Batal
                </button>
                <button 
                  onClick={() => {
                    const action = modalConfig.onConfirm;
                    setModalConfig({ ...modalConfig, isOpen: false });
                    action();
                  }}
                  className={`flex-1 text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-md ${
                    modalConfig.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' :
                    modalConfig.type === 'success' ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  }`}
                >
                  Ya, Lanjutkan
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // TAMPILAN FORM ABSEN (ATLET ATAU PELATIH) - 1 KOTAK KAMERA DINAMIS
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

        {/* 1 KOTAK KAMERA DINAMIS */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1 text-gray-700">Foto Selfie</label>
          <div className="relative w-full rounded overflow-hidden bg-black h-48 border mb-2 flex items-center justify-center">
            {photo ? (
              <img src={photo} alt="Hasil Selfie" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden"></canvas>

          {photo ? (
            <button 
              onClick={startCamera} 
              className="bg-amber-600 text-white text-xs py-2 px-4 rounded-lg font-semibold w-full flex items-center justify-center gap-1.5 shadow"
            >
              <ArrowPathIcon className="w-4 h-4" /> Foto Ulang
            </button>
          ) : (
            <button 
              onClick={takePhoto} 
              className="bg-blue-600 text-white text-xs py-2 px-4 rounded-lg font-semibold w-full flex items-center justify-center gap-1.5 shadow"
            >
              <CameraIcon className="w-4 h-4" /> Ambil Foto
            </button>
          )}
        </div>

        <div className="mb-4 w-full">
          <label className="block text-sm font-semibold mb-1 text-gray-700">Tanda Tangan Digital</label>
          <div className="w-full overflow-hidden border rounded bg-gray-50 mb-2">
            <canvas
              ref={sigCanvasRef}
              width={380}
              height={150}
              className="w-full h-[150px] cursor-crosshair touch-none bg-gray-50"
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseMove={draw}
              onTouchStart={startDrawing}
              onTouchEnd={stopDrawing}
              onTouchMove={draw}
            ></canvas>
          </div>
          <button onClick={clearSignature} className="bg-red-500 text-white text-xs py-1 px-3 rounded font-semibold hover:bg-red-600">Ulangi TTD</button>
        </div>

        <button 
          disabled={!isValidLocation || !photo || !signature}
          onClick={confirmKirimAbsen}
          className={`w-full py-2.5 rounded-lg font-semibold mt-4 text-white ${
            isValidLocation && photo && signature 
              ? 'bg-blue-600 hover:bg-blue-700 shadow-md' 
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isValidLocation ? 'Kirim Absen' : 'Diluar Jangkauan Lokasi'}
        </button>
      </div>

      {/* MODAL KONFIRMASI KUSTOM SERAGAM */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center transform transition-all animate-in fade-in zoom-in-95">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
              modalConfig.type === 'danger' ? 'bg-red-100 text-red-500' :
              modalConfig.type === 'success' ? 'bg-green-100 text-green-500' : 'bg-amber-100 text-amber-500'
            }`}>
              {modalConfig.type === 'danger' ? <TrashIcon className="w-6 h-6" /> :
               modalConfig.type === 'success' ? <CheckIcon className="w-6 h-6" /> : <PencilSquareIcon className="w-6 h-6" />}
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">{modalConfig.title}</h3>
            <p className="text-xs text-gray-500 mb-6">{modalConfig.message}</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2.5 rounded-xl transition"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  const action = modalConfig.onConfirm;
                  setModalConfig({ ...modalConfig, isOpen: false });
                  action();
                }}
                className={`flex-1 text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-md ${
                  modalConfig.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' :
                  modalConfig.type === 'success' ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                }`}
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}