import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc, serverTimestamp, addDoc, arrayRemove, arrayUnion, deleteDoc, increment, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import Head from 'next/head';

export default function ClassManagement() {
  const router = useRouter();
  const { id: classId } = router.query;
  const [activeTab, setActiveTab] = useState('tugasan'); 
  const [classData, setClassData] = useState(null);
  const [teacherData, setTeacherData] = useState(null); 
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Storage Vault states
  const [vaultFiles, setVaultFiles] = useState([]);
  const [showVaultBrowser, setShowVaultBrowser] = useState(false);
  const [vaultLoading, setVaultLoading] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showLookupModal, setShowLookupModal] = useState(false);
  
  // Forms
  const [bulkInput, setBulkInput] = useState('');
  const [newTask, setNewTask] = useState({ 
    title: '', 
    instructions: '', 
    dueDate: '', 
    targetClasses: [], 
    file: null,
    existingUrl: '', // Track selected asset from user locker repository
    studentConfig: {} 
  });

  const toggleStudentMode = (studentId) => {
    setNewTask(prev => ({
      ...prev,
      studentConfig: {
        ...prev.studentConfig,
        [studentId]: prev.studentConfig[studentId] === 'scaffolded' ? 'standard' : 'scaffolded'
      }
    }));
  };

  const [teacherClasses, setTeacherClasses] = useState([]);
  const [schoolRegistry, setSchoolRegistry] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [lookupSearch, setLookupSearch] = useState(''); 

  useEffect(() => {
    if (classId) {
      fetchData();
    }
  }, [classId]);

  const fetchData = async () => {
    try {
      // 1. Fetch Class & Teacher Data
      const cSnap = await getDoc(doc(db, 'classes', classId));
      if (!cSnap.exists()) return;
      const cData = cSnap.data();
      setClassData(cData);

      const tSnap = await getDoc(doc(db, 'users', cData.teacherId));
      if (tSnap.exists()) setTeacherData(tSnap.data());

      const classesQuery = query(collection(db, 'classes'), where('teacherId', '==', cData.teacherId));
      const classesSnap = await getDocs(classesQuery);
      setTeacherClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 2. Fetch Students and Sync Credits
      const sQuery = query(collection(db, 'students'), where('enrolledClasses', 'array-contains', classId));
      const sSnap = await getDocs(sQuery);
      const studentList = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const enrichedStudentList = await Promise.all(studentList.map(async (s) => {
        const userDoc = await getDoc(doc(db, 'users', s.id));
        return userDoc.exists() ? { ...s, credits: userDoc.data().credits || 0 } : s;
      }));
      setStudents(enrichedStudentList);

      // 3. Fetch Assignments & Calculate Progress
      const aQuery = query(collection(db, 'assignments'), where('classId', '==', classId));
      const aSnap = await getDocs(aQuery);
      const assignmentList = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const rQuery = query(collection(db, 'karanganResults'), where('classId', '==', classId));
      const rSnap = await getDocs(rQuery);
      const allResults = rSnap.docs.map(d => d.data());

      const enrichedAssignments = assignmentList.map(task => {
        const completedCount = allResults.filter(r => 
          r.taskId === task.id && 
          (r.status === 'submitted' || r.status === 'murni_in_progress' || r.studentProgress?.percentComplete === 100)
        ).length;
        
        const progressPercent = enrichedStudentList.length > 0 ? (completedCount / enrichedStudentList.length) * 100 : 0;
        return { ...task, completedCount, progressPercent };
      });

      // UI/UX FIX: Chronological Sorting Sequence (Newest First)
      const sortedAssignments = enrichedAssignments.sort((a, b) => {
        const dateA = a.createdAt?.seconds ? a.createdAt.seconds : 0;
        const dateB = b.createdAt?.seconds ? b.createdAt.seconds : 0;
        return dateB - dateA;
      });

      setAssignments(sortedAssignments);
    } catch (e) { 
      console.error("Fetch Data Error:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  // UI/UX REPOSITORY FUNCTION: Fetch teacher's specific storage folder 
  const fetchTeacherVault = async () => {
    if (!classData?.teacherId) return;
    setVaultLoading(true);
    setShowVaultBrowser(true);
    try {
      const listRef = ref(storage, `teachers/${classData.teacherId}/stimulus/`);
      const res = await listAll(listRef);
      const files = await Promise.all(res.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return { name: itemRef.name, url };
      }));
      setVaultFiles(files);
    } catch (err) {
      console.error("Gagal membaca arkib fail:", err);
    } finally {
      setVaultLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title || newTask.targetClasses.length === 0) {
      return alert("Sila masukkan tajuk dan pilih sekurang-kurangnya satu kelas.");
    }

    try {
      let fileUrl = newTask.existingUrl || "";
      
      // 1. File Repository Save Routine (Only if uploading a fresh file)
      if (newTask.file && !newTask.existingUrl) {
        console.log("Uploading fresh asset...", newTask.file.name);
        const fileName = `${Date.now()}_${newTask.file.name.replace(/\s+/g, '_')}`;
        // Automatically route file into user isolated folder hierarchy path framework
        const fileRef = ref(storage, `teachers/${classData.teacherId}/stimulus/${fileName}`);
        
        const uploadResult = await uploadBytes(fileRef, newTask.file);
        fileUrl = await getDownloadURL(uploadResult.ref);
      }

      // 2. Batch write across multiple classes targets
      const batch = writeBatch(db);
      
      for (const targetId of newTask.targetClasses) {
        const newTaskRef = doc(collection(db, 'assignments'));
        batch.set(newTaskRef, {
          title: newTask.title,
          instructions: newTask.instructions || "",
          dueDate: newTask.dueDate || null,
          attachmentUrl: fileUrl,
          classId: targetId,
          teacherId: classData.teacherId,
          createdAt: serverTimestamp(),
          status: 'active',
          studentConfig: newTask.studentConfig // Persisted target for differentiation mapping arrays
        });
      }

      await batch.commit();
      alert("Tugasan berjaya dihantar.");
      setShowTaskModal(false);
      setNewTask({ title: '', instructions: '', dueDate: '', targetClasses: [], file: null, existingUrl: '', studentConfig: {} });
      fetchData();
    } catch (e) {
      console.error("Full Error details:", e);
      alert("Ralat teknikal: " + (e.message || "Gagal memuat naik tugasan."));
    }
  };

  const handleRemoveFromClass = async (studentId) => {
    try {
      const studentRef = doc(db, 'students', studentId);
      await updateDoc(studentRef, { enrolledClasses: arrayRemove(classId) });
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (error) {
      console.error("Error removing student:", error);
    }
  };

  const handleDeleteTask = async (taskId, e) => {
    e.stopPropagation(); 
    if (!confirm("Padam tugasan ini? Semua progres pelajar untuk tugasan ini akan hilang.")) return;
    try {
      const taskRef = doc(db, 'assignments', taskId);
      const taskSnap = await getDoc(taskRef);
      
      if (taskSnap.exists()) {
        const taskData = taskSnap.data();
        // UX Logic Note: Only remove items from cloud storage if they aren't part of the shared repository references
        if (taskData.attachmentUrl && !taskData.attachmentUrl.includes('/stimulus%2F')) {
          try {
            const fileRef = ref(storage, taskData.attachmentUrl);
            await deleteObject(fileRef);
          } catch (storageErr) {
            console.error("Storage deletion failed or file not found:", storageErr);
          }
        }
      }

      await deleteDoc(taskRef);
      fetchData();
    } catch (e) { alert("Ralat memadam tugasan."); }
  };

  const handleBulkAdd = async () => {
    const lines = bulkInput.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;

    for (let line of lines) {
      const [name, className] = line.split(',').map(s => s?.trim());
      if (!name) continue;

      const studentId = name.toLowerCase().replace(/\s+/g, '') + Math.floor(1000 + Math.random() * 9000);
      const tempPass = "PINTAR123";
      
      await setDoc(doc(db, 'students', studentId), {
        nama: name,
        name: name,
        customClass: className || classData?.className || "Tiada Kelas",
        username: studentId,
        password: tempPass,
        sekolah: teacherData?.sekolah || classData?.schoolName || "Sekolah Bestari", 
        enrolledClasses: [classId],
        level: classData?.level || 'P6',
        registeredAt: serverTimestamp(),
        credits: 0,
        role: "student"
      });
    }
    setBulkInput('');
    setShowAddModal(false);
    fetchData();
  };

  const handleMassDelete = async () => {
    if (!confirm(`Keluarkan ${selectedStudents.length} pelajar daripada kelas ini?`)) return;
    for (const sid of selectedStudents) {
      await updateDoc(doc(db, 'students', sid), { enrolledClasses: arrayRemove(classId) });
    }
    setSelectedStudents([]);
    fetchData();
  };

  const handleMassPasswordReset = async () => {
    const newPass = prompt("Masukkan kata laluan baru untuk pelajar terpilih:");
    if (!newPass) return;
    for (const sid of selectedStudents) {
      await updateDoc(doc(db, 'students', sid), { password: newPass });
    }
    alert("Kata laluan dikemaskini.");
    setSelectedStudents([]);
    fetchData();
  };

  const handleMassAddCredits = async () => {
    const amountStr = prompt(`Tambah berapa kredit kepada ${selectedStudents.length} pelajar terpilih?`);
    const amount = parseInt(amountStr);
    if (!amount || isNaN(amount) || amount <= 0) return;

    const totalNeeded = amount * selectedStudents.length;

    try {
      const teacherRef = doc(db, 'users', classData.teacherId);
      const teacherSnap = await getDoc(teacherRef);

      if (!teacherSnap.exists()) return alert("Ralat: Data guru tidak dijumpai.");
      const teacherCredits = teacherSnap.data().credits || 0;

      if (teacherCredits < totalNeeded) {
        return alert(`Kredit tidak mencukupi. Anda perlu ${totalNeeded} kredit, baki semasa: ${teacherCredits}`);
      }

      const batch = writeBatch(db);
      batch.update(teacherRef, { credits: increment(-totalNeeded) });

      selectedStudents.forEach(sid => {
        const sRef = doc(db, 'students', sid);
        const uRef = doc(db, 'users', sid);
        
        batch.update(sRef, { credits: increment(amount) });
        batch.set(uRef, { 
            credits: increment(amount),
            role: "student",
            updatedAt: serverTimestamp() 
        }, { merge: true }); 
      });

      await batch.commit();
      alert(`Berjaya! ${totalNeeded} kredit dipindahkan.`);
      setSelectedStudents([]);
      fetchData();
    } catch (e) {
      console.error("Mass Credit Error:", e);
      alert("Ralat: " + e.message);
    }
  };

  const handleAddCredits = async (studentId) => {
    const amountStr = prompt("Berapa banyak kuota semakan AI ingin ditambah?");
    const amount = parseInt(amountStr);
    if (!amount || isNaN(amount) || amount <= 0) return;
    
    try {
      const teacherRef = doc(db, 'users', classData.teacherId);
      const teacherSnap = await getDoc(teacherRef);
      const teacherCredits = teacherSnap.data().credits || 0;

      if (teacherCredits < amount) return alert("Kredit anda tidak mencukupi.");

      const batch = writeBatch(db);
      
      batch.update(teacherRef, { credits: increment(-amount) });
      batch.update(doc(db, 'students', studentId), { credits: increment(amount) });
      batch.set(doc(db, 'users', studentId), { 
          credits: increment(amount),
          role: "student",
          updatedAt: serverTimestamp()
      }, { merge: true });
      
      await batch.commit();
      alert("Kuota berjaya dikemaskini.");
      fetchData();
    } catch (e) {
      console.error("Single Credit Error:", e);
      alert("Ralat: " + e.message);
    }
  };

  const fetchSchoolRegistry = async () => {
    try {
      const schoolToMatch = teacherData?.sekolah || classData?.schoolName || classData?.sekolah || "";
      if (!schoolToMatch) {
        return alert("Nama sekolah tidak dijumpai. Sila pastikan anda telah mengisi Nama Sekolah di menu 'Profil Guru'.");
      }

      const q = query(collection(db, 'students'), where('sekolah', '==', schoolToMatch));
      const snap = await getDocs(q);
      
      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => {
          const enrolled = s.enrolledClasses || [];
          return !enrolled.includes(classId);
        });
      
      if (filtered.length === 0) {
        alert(`Tiada pelajar lain dari ${schoolToMatch} dijumpai dalam sistem.`);
      }

      setSchoolRegistry(filtered);
      setShowLookupModal(true);
    } catch (err) {
      console.error("Error fetching registry:", err);
      alert("Galat: " + err.message);
    }
  };

  const filteredRegistry = schoolRegistry.filter(s => 
    (s.nama || s.name || "").toLowerCase().includes(lookupSearch.toLowerCase())
  );

  if (loading) return <div className="loader">Memuatkan Panel Guru...</div>;

  return (
    <div className="admin-container">
      <Head><title>Urus Kelas: {classData?.className}</title></Head>
      
      <header className="class-header">
        <div className="header-top">
          <button className="btn-back" onClick={() => {
            if (teacherData?.role === 'admin') {
              router.push('/admin/urus-kelas');
            } else {
              router.push('/urus-kelas');
            }
          }}>← Kembali</button>
          
          <div className="title-group">
              <h1>{classData?.className}</h1>
              <p>{classData?.schoolName}</p>
          </div>
          <div className="stats-pills">
            <span>{students.length} Pelajar</span>
            <span>{assignments.length} Tugasan</span>
            <span style={{background: '#F59E0B'}}>Baki Kredit Guru: {teacherData?.credits || 0}</span>
          </div>
        </div>
        
        <nav className="tab-nav">
          <button className={activeTab === 'tugasan' ? 'active' : ''} onClick={() => setActiveTab('tugasan')}>🎯 Tugasan & Progres</button>
          <button className={activeTab === 'pelajar' ? 'active' : ''} onClick={() => setActiveTab('pelajar')}>👥 Pengurusan Pelajar</button>
        </nav>
      </header>

      <main className="content-area">
        {activeTab === 'tugasan' ? (
          <section className="tugasan-section">
            <div className="action-row">
                <button className="btn-primary" onClick={() => setShowTaskModal(true)}>+ Bina Tugasan Baru</button>
            </div>
            <div className="sets-grid">
              {assignments.map(task => (
                <div key={task.id} className="set-card" onClick={() => router.push(`/Class/track/${task.id}?classId=${classId}`)}>
                  <div className="set-info">
                    <div style={{display:'flex', justifyValue:'space-between', alignItems:'center'}}>
                        <span className="date-badge">📅 {task.dueDate || 'Tiada Tarikh'}</span>
                        <button className="btn-reset" onClick={(e) => handleDeleteTask(task.id, e)}>Padam</button>
                    </div>
                    <h3>{task.title}</h3>
                  </div>
                  <div className="progress-zone">
                    <div className="progress-text">
                        <span>Progres Kelas</span>
                        <span>{task.completedCount}/{students.length} Selesai</span>
                    </div>
                    <div className="track-bar-bg">
                        <div className="track-fill" style={{width: `${task.progressPercent}%`}}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="student-mgmt">
            <div className="action-row" style={{display:'flex', gap:'10px'}}>
              <button className="btn-add" onClick={() => setShowAddModal(true)}>+ Tambah Pelajar (Pukal)</button>
              <button className="btn-primary" style={{background: '#48A6A7'}} onClick={fetchSchoolRegistry}>+ Tambah Pelajar Sedia Ada</button>
              
              {selectedStudents.length > 0 && (
                <div style={{marginLeft:'auto', display:'flex', gap:'10px'}}>
                    <button className="btn-add" style={{background: '#48A6A7'}} onClick={handleMassAddCredits}>+ Kredit Terpilih</button>
                    <button className="btn-reset" style={{background:'#C53030', color:'white'}} onClick={handleMassDelete}>Padam Terpilih</button>
                    <button className="btn-reset" onClick={handleMassPasswordReset}>Reset Password Terpilih</button>
                </div>
              )}
            </div>
            <table className="std-table">
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={(e) => setSelectedStudents(e.target.checked ? students.map(s => s.id) : [])}/></th>
                  <th>Nama Pelajar</th>
                  <th>Kelas</th>
                  <th>User ID</th>
                  <th>Baki Semakan</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td><input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => setSelectedStudents(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])}/></td>
                    <td className="bold" onClick={() => router.push(`/analisis/student/${s.id}`)}>{s.nama || s.name}</td>
                    <td>{s.customClass || classData.className}</td>
                    <td><code>{s.id}</code></td>
                    <td><span className="credit-badge">{s.credits || 0} Kali</span></td>
                    <td style={{display:'flex', gap:'5px'}}>
                        <button className="btn-reset" style={{color:'#00767B', borderColor:'#00767B', background:'#E6F4F4'}} onClick={() => handleAddCredits(s.id)}>+ Kredit</button>
                        <button className="btn-reset" onClick={async () => {
                            const newCls = prompt("Masukkan Nama Kelas Baru:");
                            if(newCls) await updateDoc(doc(db, 'students', s.id), { customClass: newCls });
                            fetchData();
                        }}>Tukar Kelas</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>

      {/* MODAL: TAMBAH PELAJAR */}
      {showAddModal && (
        <div className="modal">
          <div className="modal-content large">
            <h3>Pendaftaran Pukal Pelajar</h3>
            <p className="hint">Format Excel: <b>Nama, Kelas</b> (Satu pelajar setiap baris)</p>
            <textarea 
                value={bulkInput} 
                onChange={(e) => setBulkInput(e.target.value)} 
                placeholder="Contoh:&#10;Ahmad Ali, 6 Amanah&#10;Siti Sarah, 6 Bestari" 
            />
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Batal</button>
              <button className="confirm" onClick={handleBulkAdd}>Daftar {bulkInput.split('\n').filter(x=>x).length} Pelajar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BINA TUGASAN */}
      {showTaskModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Bina Tugasan Baru</h3>
            
            <div className="form-group">
                <label>Hantar kepada kelas:</label>
                <select 
                  multiple 
                  style={{height: '90px'}}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setNewTask({...newTask, targetClasses: selected});
                  }}
                >
                  {teacherClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.className}</option>
                  ))}
                </select>
            </div>

            <div className="form-group">
                <label>Tajuk Tugasan</label>
                <input type="text" placeholder="Contoh: Karangan Berkelah" onChange={e => setNewTask({...newTask, title: e.target.value})} />
            </div>

            {/* UI/UX REPOSITORY DESIGN INTEGRATION */}
            <div className="form-group">
                <label>Bahan Rangsangan (Stimulus)</label>
                {newTask.existingUrl ? (
                  <div className="selected-vault-file">
                    <span>📄 {newTask.title || "Fail Terpilih dari Arkib"}</span>
                    <button type="button" className="btn-remove-file" onClick={() => setNewTask({...newTask, existingUrl: ''})}>Tukar Fail</button>
                  </div>
                ) : (
                  <div className="media-upload-options">
                    <input 
                      type="file" 
                      key={showTaskModal ? 'open' : 'closed'} 
                      onChange={e => setNewTask({...newTask, file: e.target.files[0]})} 
                    />
                    <div style={{textAlign: 'center', margin: '8px 0', fontSize: '0.8rem', color: '#64748B'}}>— ATAU —</div>
                    <button type="button" className="btn-vault-trigger" onClick={fetchTeacherVault}>📂 Pilih dari Arkib Fail Peribadi Anda</button>
                  </div>
                )}
            </div>

            <div className="form-group">
                <label>Arahan Tambahan (Opsional)</label>
                <textarea className="small-text" placeholder="Tulis arahan huraian tajuk..." onChange={e => setNewTask({...newTask, instructions: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Diferensiasi Aras Murid (Opsional)</label>
              <p className="hint" style={{marginTop: '-5px', fontSize: '0.7rem'}}>Pelajar terpilih sebagai 'Scaffolded' akan mendapat sokongan template bantuan Subjek/Predikat di halaman mereka.</p>
              <div className="student-diff-list">
                {students.map(s => (
                  <div key={s.id} className="student-diff-item">
                    <span>{s.nama || s.name}</span>
                    <button 
                      type="button"
                      className={`btn-mode-toggle ${newTask.studentConfig[s.id] === 'scaffolded' ? 'is-scaffold' : ''}`}
                      onClick={() => toggleStudentMode(s.id)}
                    >
                      {newTask.studentConfig[s.id] === 'scaffolded' ? '🧩 Scaffolded' : '📝 Standard'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
                <label>Tarikh Tutup</label>
                <input type="date" onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
            </div>

            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowTaskModal(false)}>Batal</button>
              <button className="confirm" onClick={handleCreateTask}>Hantar ke Dashboard Pelajar</button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: TEACHER PRIVATE STORAGE VAULT */}
      {showVaultBrowser && (
        <div className="modal" style={{zIndex: 110}}>
          <div className="modal-content" style={{width: '450px', background: '#fdfdfd'}}>
            <h3>Arkib Fail Peribadi Anda</h3>
            <p className="hint" style={{marginTop: '-5px'}}>Fail yang pernah anda muat naik sebelum ini:</p>
            
            {vaultLoading ? (
              <div style={{padding: '20px', textAlign: 'center', fontSize: '0.9rem'}}>Membuka locker fail...</div>
            ) : (
              <div className="vault-list-container">
                {vaultFiles.length === 0 ? (
                  <p style={{textAlign: 'center', color: '#94a3b8', padding: '20px', fontSize: '0.85rem'}}>Tiada fail dijumpai. Sila muat naik fail baru menerusi komputer.</p>
                ) : (
                  vaultFiles.map((file, i) => (
                    <div key={i} className="vault-item-row">
                      <span className="vault-item-name" title={file.name}>📄 {file.name}</span>
                      <button type="button" className="btn-vault-select" onClick={() => {
                        setNewTask({ ...newTask, existingUrl: file.url, title: file.name.split('_').slice(1).join('_') || newTask.title });
                        setShowVaultBrowser(false);
                      }}>Pilih</button>
                    </div>
                  ))
                )}
              </div>
            )}
            
            <div className="modal-btns" style={{marginTop: '15px'}}>
              <button type="button" className="btn-cancel" onClick={() => setShowVaultBrowser(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SCHOOL LOOKUP */}
      {showLookupModal && (
        <div className="modal">
          <div className="modal-content large">
            <h3>Cari Pelajar ({classData?.schoolName})</h3>
            <input 
              type="text" 
              placeholder="Cari nama pelajar..." 
              value={lookupSearch}
              onChange={(e) => setLookupSearch(e.target.value)}
              style={{marginBottom: '15px'}}
            />
            <div style={{maxHeight:'300px', overflowY:'auto', border:'1px solid #eee', borderRadius:'10px'}}>
                {filteredRegistry.map(s => (
                    <div key={s.id} style={{padding:'10px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #f0f0f0'}}>
                        <div>
                            <p style={{margin:0, fontWeight:'bold'}}>{s.nama || s.name}</p>
                            <p style={{margin:0, fontSize:'0.75rem'}}>{s.customClass || 'Tiada Kelas'}</p>
                        </div>
                        <button className="btn-primary" style={{padding:'5px 10px', fontSize:'0.8rem'}} onClick={async () => {
                            await updateDoc(doc(db, 'students', s.id), { enrolledClasses: arrayUnion(classId) });
                            fetchData();
                            setShowLookupModal(false);
                        }}>+ Tambah</button>
                    </div>
                ))}
            </div>
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowLookupModal(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-container { background: #f0f4f4; min-height: 100vh; font-family: 'Plus Jakarta Sans', sans-serif; }
        .class-header { background: #003D40; color: white; padding: 30px 50px 0; }
        .header-top { display: flex; align-items: center; gap: 20px; margin-bottom: 25px; }
        .title-group h1 { margin: 0; font-size: 1.8rem; }
        .title-group p { margin: 0; opacity: 0.6; font-size: 0.9rem; }
        .btn-back { background: rgba(255,255,255,0.1); border: none; color: white; padding: 10px 15px; border-radius: 8px; cursor: pointer; }
        .stats-pills { display: flex; gap: 10px; margin-left: auto; }
        .stats-pills span { background: #48A6A7; padding: 6px 15px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
        .tab-nav { display: flex; gap: 5px; }
        .tab-nav button { background: transparent; border: none; color: rgba(255,255,255,0.5); padding: 15px 30px; cursor: pointer; font-weight: 700; border-radius: 12px 12px 0 0; transition: 0.3s; }
        .tab-nav button.active { background: #f0f4f4; color: #003D40; }
        .content-area { padding: 40px 50px; }
        .action-row { margin-bottom: 30px; }
        .btn-primary { background: #003D40; color: white; border: none; padding: 12px 25px; border-radius: 12px; font-weight: 700; cursor: pointer; }
        .btn-add { background: #00767B; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; cursor: pointer; }
        .sets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 25px; }
        .set-card { background: white; padding: 25px; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); cursor: pointer; transition: 0.3s; border: 1px solid transparent; }
        .set-card:hover { transform: translateY(-5px); border-color: #48A6A7; }
        .date-badge { font-size: 0.75rem; color: #EF4444; font-weight: 700; }
        .progress-zone { margin-top: 20px; }
        .progress-text { display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; color: #64748B; margin-bottom: 8px; }
        .track-bar-bg { height: 10px; background: #E2E8F0; border-radius: 20px; overflow: hidden; }
        .track-fill { height: 100%; background: #22C55E; border-radius: 20px; transition: 1s ease-in-out; }
        .std-table { width: 100%; background: white; border-radius: 20px; border-collapse: collapse; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .std-table th { background: #E6F4F4; text-align: left; padding: 18px; color: #003D40; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; }
        .std-table td { padding: 18px; border-bottom: 1px solid #f0f0f0; }
        .bold { font-weight: 800; color: #00767B; cursor: pointer; }
        code { background: #F1F5F9; padding: 4px 8px; border-radius: 6px; font-weight: 600; color: #475569; }
        .credit-badge { background: #F0FFF4; color: #2F855A; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 0.8rem; }
        .btn-reset { background: #FFF5F5; color: #C53030; border: 1px solid #FEB2B2; padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; }
        .modal { position: fixed; inset: 0; background: rgba(0,45,47,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
        .student-diff-list { max-height: 140px; overflow-y: auto; border: 2px solid #E2E8F0; border-radius: 12px; padding: 5px; background: #f8fafc; }
        .student-diff-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #edf2f7; }
        .btn-mode-toggle { padding: 4px 10px; border-radius: 15px; border: 1px solid #cbd5e1; background: white; font-size: 0.7rem; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .btn-mode-toggle.is-scaffold { background: #00767B; color: white; border-color: #00767B; }
        .modal-content { background: white; padding: 35px; border-radius: 30px; width: 480px; box-shadow: 0 20px 50px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto; }
        .modal-content.large { width: 600px; }
        .form-group { margin-bottom: 18px; }
        .form-group label { display: block; font-weight: 700; margin-bottom: 8px; font-size: 0.9rem; color: #002d2f; }
        input, textarea, select { width: 100%; padding: 12px; border: 2px solid #E2E8F0; border-radius: 12px; font-family: inherit; }
        textarea.small-text { height: 70px; }
        textarea { height: 220px; resize: none; }
        .hint { font-size: 0.78rem; color: #64748B; margin-bottom: 12px; display: block; line-height: 1.3; }
        .modal-btns { display: flex; justify-content: flex-end; gap: 15px; margin-top: 20px; }
        .btn-cancel { background: #F1F5F9; border: none; padding: 12px 25px; border-radius: 12px; font-weight: 700; cursor: pointer; }
        .confirm { background: #003D40; color: white; border: none; padding: 12px 25px; border-radius: 12px; font-weight: 700; cursor: pointer; }
        
        /* REPOSITORY COMPONENT STYLING */
        .btn-vault-trigger { background: #F0FDF4; border: 2px dashed #48A6A7; color: #00767B; padding: 10px; border-radius: 12px; font-weight: 700; font-size: 0.8rem; cursor: pointer; width: 100%; transition: 0.2s; }
        .btn-vault-trigger:hover { background: #E6F4F4; }
        .selected-vault-file { display: flex; justify-content: space-between; align-items: center; background: #E6F4F4; border: 2px solid #00767B; padding: 10px 15px; border-radius: 12px; font-size: 0.85rem; font-weight: 700; color: #003D40; }
        .btn-remove-file { background: #FFF5F5; color: #C53030; border: 1px solid #FEB2B2; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; font-weight: bold; }
        .vault-list-container { max-height: 200px; overflow-y: auto; border: 1px solid #E2E8F0; border-radius: 12px; background: #fff; }
        .vault-item-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #F1F5F9; }
        .vault-item-name { font-size: 0.8rem; font-weight: 600; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; }
        .btn-vault-select { background: #003D40; color: white; border: none; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; }
      `}</style>
    </div>
  );
}