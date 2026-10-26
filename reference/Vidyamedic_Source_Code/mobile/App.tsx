import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, View} from 'react-native';
import {API_URL, api, type Dashboard, type Insight, type Profile, type BI, type Recs, type Point} from './api';

type Tab = 'Beranda'|'Hari Ini'|'Insight'|'Tanya AI'|'Profil';
const TABS:Tab[]=['Beranda','Hari Ini','Insight','Tanya AI','Profil'];
const CONTEXTS=['Istirahat / duduk tenang','Baru selesai berjalan / naik tangga','Sedang fokus / stres mental','Aktivitas rumah tangga','Konteks belum dapat dipastikan'];
const C={navy:'#182B42',ink:'#243A50',muted:'#74869B',bg:'#F3F7FA',mint:'#168C87',light:'#E8F6F3',border:'#E1E9F0',amber:'#966321',amberLight:'#FFF4E5',white:'#FFFFFF'};

function Tile({title,value,unit,desc}:{title:string;value:string|number;unit?:string;desc?:string}) {return <View style={s.tile}><Text style={s.muted}>{title}</Text><View style={s.inline}><Text style={s.big}>{value}</Text>{unit?<Text style={s.unit}>{unit}</Text>:null}</View>{desc?<Text style={s.caption}>{desc}</Text>:null}</View>}
function Card({children,title}:{children:React.ReactNode;title?:string}){return <View style={s.card}>{title?<Text style={s.cardTitle}>{title}</Text>:null}{children}</View>}
function Button({title,onPress,secondary=false,disabled=false}:{title:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){return <Pressable disabled={disabled} onPress={onPress} style={[s.button,secondary&&s.buttonSecondary,disabled&&{opacity:.5}]}><Text style={[s.buttonText,secondary&&{color:C.mint}]}>{title}</Text></Pressable>}
function Label({text,tone='mint'}:{text:string;tone?:'mint'|'amber'}){return <View style={[s.label,{backgroundColor:tone==='mint'?C.light:C.amberLight}]}><Text style={{fontSize:11,fontWeight:'700',color:tone==='mint'?C.mint:C.amber}}>{text}</Text></View>}
function Section({title,children}:{title:string;children:React.ReactNode}){return <View style={{gap:9,marginBottom:14}}><Text style={s.section}>{title}</Text>{children}</View>}
function Plot({data}:{data:Point[]}){const sampled=data.filter((_,i)=>i%6===0);return <View><View style={s.plot}>{sampled.map((p,i)=><View key={i} style={s.plotCol}><View style={[s.plotBar,{height:`${Math.min(100,Math.max(8,(p.hr-40)/.9))}%`,backgroundColor:p.hr>100?'#C78C55':C.mint}]}/></View>)}</View><View style={s.between}><Text style={s.caption}>00.00</Text><Text style={s.caption}>12.00</Text><Text style={s.caption}>24.00</Text></View><Text style={s.caption}>HR ilustratif (bpm), sampel per jam · bukan sinyal medis langsung</Text></View>}
export default function App(){
  const [tab,setTab]=useState<Tab>('Beranda');
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [insight,setInsight]=useState<Insight|null>(null);
  const [bi,setBI]=useState<BI|null>(null);
  const [recs,setRecs]=useState<Recs|null>(null);
  const [period,setPeriod]=useState<7|30|90>(7);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [modal,setModal]=useState(false);
  const [context,setContext]=useState(CONTEXTS[0]);
  const [symptoms,setSymptoms]=useState('Tidak tahu');
  const [note,setNote]=useState('');
  const [question,setQuestion]=useState('');
  const [history,setHistory]=useState<{from:'me'|'ai';text:string}[]>([{from:'ai',text:'Halo! Saya asisten Vidyamedic demonstrasi. Tanyakan perubahan HR, pemulihan, atau rekomendasi pemantauan. Saya bukan pengganti tenaga kesehatan.'}]);

  const load=useCallback(async()=>{
    setError('');
    try{
      const [d,p,i,b,r]=await Promise.all([
        api<Dashboard>('/api/dashboard'),api<Profile>('/api/profile'),api<Insight>('/api/ai/insights'),api<BI>(`/api/bi?days=${period}`),api<Recs>('/api/recommendations')
      ]);
      setDashboard(d);setProfile(p);setInsight(i);setBI(b);setRecs(r);
    }catch(e){setError(`Gagal terhubung ke API (${API_URL}). Periksa alamat IP server dan jaringan. ${String(e)}`)}finally{setLoading(false)}
  },[period]);
  useEffect(()=>{setLoading(true);void load()},[load]);
  const send=async(q:string)=>{
    const msg=q.trim();if(!msg||busy)return;
    setBusy(true);setQuestion('');setHistory(h=>[...h,{from:'me',text:msg}]);
    try{const r=await api<{answer:string}>('/api/ai/chat',{method:'POST',body:JSON.stringify({message:msg})});setHistory(h=>[...h,{from:'ai',text:r.answer}])}
    catch{setHistory(h=>[...h,{from:'ai',text:'API tidak dapat dihubungi. Periksa koneksi dan coba lagi.'}])}
    finally{setBusy(false)}
  };
  const saveCheckin=async()=>{
    setBusy(true);
    try{await api('/api/checkins',{method:'POST',body:JSON.stringify({event_id:'evt-1425',context,symptoms,note})});setModal(false);setNote('');await load();Alert.alert('Tersimpan','Konteks tercatat. Interpretasi AI memerlukan peninjauan ulang.')}
    catch(e){Alert.alert('Gagal menyimpan',String(e))}finally{setBusy(false)}
  };
  const markComplete=async(id:string)=>{
    try{await api(`/api/recommendations/${id}/complete`,{method:'POST',body:JSON.stringify({status:'done'})});await load()}
    catch(e){Alert.alert('Gagal',String(e))}
  };
  const MetricRow=({label,value}:{label:string;value:string})=><View style={s.metricRow}><Text style={s.muted}>{label}</Text><Text style={{fontWeight:'700',color:C.ink}}>{value}</Text></View>;
  const choosePeriod=()=> <View style={[s.inline,{marginBottom:12}]}>{([7,30,90] as const).map(d=><Pressable key={d} onPress={()=>setPeriod(d)} style={[s.period,period===d&&{backgroundColor:C.mint}]}><Text style={{fontWeight:'700',color:period===d?'white':C.muted}}>{d} hari</Text></Pressable>)}</View>;
  const main=()=>{
    if(loading&&!dashboard)return <View style={s.center}><ActivityIndicator color={C.mint}/><Text style={s.caption}>Memuat data sintetis...</Text></View>;
    if(error&&!dashboard)return <Card title="Koneksi backend belum tersedia"><Text style={s.note}>{error}</Text><Button title="Coba lagi" onPress={()=>void load()}/></Card>;
    if(!dashboard||!profile||!insight||!bi||!recs)return null;
    if(tab==='Beranda')return <>
      <Text style={s.heading}>Selamat pagi, Alya</Text><Text style={s.subtitle}>Minggu, 25 Oktober 2026 · demonstrasi</Text>
      <Card><View style={s.between}><Text style={s.cardTitle}>Monitoring wearable</Text><Label text="SYNTHETIC DEMO"/></View><Text style={s.note}>Data contoh dievaluasi terhadap profil aktivitas, baseline personal, dan kualitas sinyal.</Text><MetricRow label="Kondisi pengamatan" value="Pemantauan aktif"/><MetricRow label="Kualitas data" value={`${dashboard.vitals.data_quality_pct}%`}/></Card>
      <View style={s.grid}><Tile title="Heart rate" value={dashboard.vitals.hr_bpm} unit="bpm" desc="Pembacaan contoh"/><Tile title="RMSSD" value={dashboard.vitals.rmssd_ms} unit="ms" desc="Proxy modulasi HRV"/><Tile title="Langkah" value={dashboard.vitals.steps} desc="Hari ini"/><Tile title="Episode" value={dashboard.summary.episodes} desc="Perlu ditinjau"/></View>
      <Card title="Perubahan penting"><View style={s.between}><Label text={dashboard.last_event.status==='needs_context'?'Perlu klarifikasi':'Konteks tercatat'} tone="amber"/><Text style={s.caption}>{dashboard.last_event.time}</Text></View><Text style={s.note}>HR {dashboard.last_event.observed_hr_bpm} bpm; ekspektasi ilustratif saat istirahat {dashboard.last_event.resting_expected_bpm} bpm. Konteks: {dashboard.last_event.context}.</Text><Button title="Klarifikasi aktivitas" onPress={()=>setModal(true)}/></Card>
      <Card title="Saran saat ini"><Text style={s.note}>Periksa kualitas perangkat, konfirmasi konteks, dan amati lintasan setelah aktivitas. Jangan menyimpulkan diagnosis dari satu pembacaan.</Text><Button title="Tanya AI" secondary onPress={()=>setTab('Tanya AI')}/></Card>
    </>;
    if(tab==='Hari Ini')return <>
      <Text style={s.heading}>Hari Ini</Text><Text style={s.subtitle}>Timeline fisiologi dan aktivitas</Text>
      <Card title="Detak jantung · 24 jam"><Plot data={dashboard.series}/></Card>
      <Card title="Ringkasan pengamatan"><MetricRow label="HR saat ringkasan" value={`${dashboard.vitals.hr_bpm} bpm`}/><MetricRow label="RR interval" value={`${dashboard.vitals.rr_ms} ms`}/><MetricRow label="RMSSD" value={`${dashboard.vitals.rmssd_ms} ms`}/><MetricRow label="Kualitas pengukuran" value={`${dashboard.vitals.data_quality_pct}%`}/></Card>
      <Card title="Episode 14:25"><Text style={s.note}>{insight.observed} {insight.interpretation}</Text><Label text={dashboard.last_event.status==='needs_context'?'Konteks belum diverifikasi':'Konteks dilaporkan'} tone="amber"/><Button title="Perbarui konteks" onPress={()=>setModal(true)}/></Card>
      <Card title="Tindakan"><View style={{gap:9}}>{recs.items.map(r=><View key={r.id} style={s.action}><Text style={s.itemTitle}>{r.title}</Text><Text style={s.caption}>{r.description}</Text>{r.status==='done'?<Label text="Selesai"/>:<Button title={r.id==='verify-context'?'Isi check-in':'Tandai selesai'} secondary onPress={()=>r.id==='verify-context'?setModal(true):void markComplete(r.id)}/>}</View>)}</View></Card>
    </>;
    if(tab==='Insight')return <>
      <Text style={s.heading}>Insight Kesehatan</Text><Text style={s.subtitle}>Tren dan konteks longitudinal</Text>
      {choosePeriod()}
      <View style={s.grid}><Tile title="HR rata-rata" value={bi.metrics.average_hr} unit="bpm"/><Tile title="Durasi recovery" value={bi.metrics.average_recovery_minutes} unit="menit"/><Tile title="Episode" value={bi.metrics.episodes}/><Tile title="Kualitas data" value={`${bi.metrics.quality_pct}%`}/></View>
      <Card title="Pola HR historis"><View style={s.plot}>{bi.trends.map((x,i)=><View key={i} style={s.plotCol}><View style={[s.plotBar,{height:`${Math.max(12,(x.mean_hr-55)*2)}%`}]}/></View>)}</View><Text style={s.caption}>Agregat simulasi. Tidak menunjukkan risiko klinis.</Text></Card>
      <Card title="Komposisi aktivitas">{bi.activity_distribution.map(item=><View key={item.context} style={{gap:5,marginBottom:13}}><View style={s.between}><Text style={s.muted}>{item.context}</Text><Text style={s.itemTitle}>{item.percent}%</Text></View><View style={s.track}><View style={[s.progress,{width:`${item.percent}%`}]}/></View></View>)}</Card>
      <Card title="Penjelasan model"><Text style={s.note}>{insight.interpretation}</Text><Text style={s.caption}>Tingkat bukti: {insight.confidence}</Text></Card>
    </>;
    if(tab==='Tanya AI')return <>
      <Text style={s.heading}>Tanya AI</Text><Text style={s.subtitle}>Bukti, interpretasi, dan rekomendasi</Text>
      <Card><Label text="ENGINE ATURAN DEMO"/><Text style={s.note}>Respons menggunakan API dan aturan sederhana. Belum memakai large language model (LLM) atau mesin diagnosis.</Text></Card>
      <View style={s.chat}>{history.map((m,i)=><View key={i} style={[s.bubble,m.from==='me'?s.myBubble:s.aiBubble]}><Text style={{color:m.from==='me'?'white':C.ink,lineHeight:21}}>{m.text}</Text></View>)}</View>
      <View style={s.suggestions}>{['Mengapa HR naik?','Apakah saya sudah pulih?','Apa yang perlu dilakukan?'].map(q=><Pressable key={q} onPress={()=>void send(q)} style={s.suggest}><Text style={{fontSize:12,color:C.mint}}>{q}</Text></Pressable>)}</View>
      <View style={s.inline}><TextInput style={s.input} placeholder="Tulis pertanyaan..." placeholderTextColor={C.muted} value={question} onChangeText={setQuestion} onSubmitEditing={()=>void send(question)}/><Button title={busy?'...':'Kirim'} disabled={busy} onPress={()=>void send(question)}/></View>
    </>;
    return <>
      <Text style={s.heading}>Profil Saya</Text><Text style={s.subtitle}>Informasi personal, baseline, privasi</Text>
      <Card><View style={s.inline}><View style={s.avatar}><Text style={{color:C.mint,fontWeight:'800'}}>AP</Text></View><View><Text style={s.cardTitle}>{profile.name}</Text><Text style={s.caption}>{profile.id} · akun fiktif</Text></View></View><MetricRow label="Usia profil contoh" value={`${profile.age} tahun`}/><MetricRow label="Sumber data" value="Generator sintetis"/><MetricRow label="Kelayakan baseline" value="Belum tervalidasi"/></Card>
      <Card title="Baseline menurut aktivitas">{profile.baseline.map(b=><View key={b.context} style={s.action}><Text style={s.itemTitle}>{b.context}</Text><Text style={s.muted}>HR {b.hr_min}–{b.hr_max} bpm · RMSSD {b.rmssd_min}–{b.rmssd_max} ms</Text><Text style={s.caption}>Bukti: {b.evidence}</Text></View>)}</Card>
      <Card title="Koneksi & privasi"><MetricRow label="Perangkat" value="Wearable simulasi"/><MetricRow label="Consent" value="Demo only"/><MetricRow label="Otentikasi" value="Belum tersedia"/><Text style={s.note}>Jangan gunakan data pasien nyata sebelum autentikasi, enkripsi, persetujuan, dan audit disiapkan.</Text></Card>
    </>;
  };
  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined}><StatusBar barStyle="dark-content" backgroundColor={C.bg}/><View style={s.top}><View><Text style={s.brand}>♥ VIDYAMEDIC</Text><Text style={s.brandSub}>PERSONAL HEALTH INTELLIGENCE</Text></View><Pressable onPress={()=>void load()}><Text style={{color:C.mint,fontWeight:'800'}}>↻ Muat ulang</Text></Pressable></View>
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()}/>}>
      {error&&dashboard?<Text style={s.error}>{error}</Text>:null}
      {main()}
      <Text style={s.footer}>● DATA FIKTIF · DEMO · Bukan sistem medis atau diagnosis.</Text>
    </ScrollView>
    <View style={s.nav}>{TABS.map((t,i)=><Pressable key={t} onPress={()=>setTab(t)} style={[s.navItem,tab===t&&s.navActive]}><Text style={{fontSize:19,color:tab===t?C.mint:C.muted}}>{['⌂','▤','▥','✦','◯'][i]}</Text><Text style={[s.navText,{color:tab===t?C.mint:C.muted}]}>{t}</Text></Pressable>)}</View>
    <Modal visible={modal} animationType="slide" transparent onRequestClose={()=>setModal(false)}><View style={s.modalBack}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalCard}><View style={s.between}><Text style={s.section}>Klarifikasi aktivitas</Text><Pressable onPress={()=>setModal(false)}><Text style={s.muted}>Tutup ✕</Text></Pressable></View><Text style={s.note}>Episode simulasi 14:25. Konfirmasi membantu memperbarui konteks, bukan memastikan diagnosis.</Text><Text style={s.itemTitle}>Aktivitas aktual</Text>{CONTEXTS.map(item=><Pressable key={item} onPress={()=>setContext(item)} style={[s.choice,context===item&&s.choiceOn]}><Text style={{color:C.ink}}>{context===item?'◉':'○'}  {item}</Text></Pressable>)}<Text style={s.itemTitle}>Gejala (laporan pengguna)</Text><View style={s.inline}>{['Tidak ada','Ada keluhan','Tidak tahu'].map(x=><Pressable key={x} onPress={()=>setSymptoms(x)} style={[s.period,symptoms===x&&{backgroundColor:C.light}]}><Text style={{fontSize:12,color:C.ink}}>{x}</Text></Pressable>)}</View><TextInput multiline maxLength={240} placeholder="Catatan opsional" placeholderTextColor={C.muted} value={note} onChangeText={setNote} style={[s.input,{height:80,textAlignVertical:'top',flex:0}]}/><Button title="Simpan konteks" disabled={busy} onPress={()=>void saveCheckin()}/></ScrollView></View></Modal>
  </KeyboardAvoidingView>;
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg,paddingTop:Platform.OS==='android'?StatusBar.currentHeight||28:48},top:{paddingHorizontal:18,paddingVertical:12,backgroundColor:'white',flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderColor:C.border},brand:{fontSize:15,fontWeight:'900',color:C.navy,letterSpacing:1},brandSub:{fontSize:9,fontWeight:'700',color:C.muted,letterSpacing:1},scroll:{flex:1},content:{padding:17,paddingBottom:28,gap:12},heading:{fontSize:25,fontWeight:'800',color:C.navy,letterSpacing:-.5},subtitle:{fontSize:12,color:C.muted,marginTop:-7,marginBottom:5},tile:{width:'48%',padding:15,backgroundColor:'white',borderWidth:1,borderColor:C.border,borderRadius:15,minHeight:110},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:10},inline:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},big:{fontSize:29,fontWeight:'800',color:C.navy},unit:{fontSize:12,color:C.muted},muted:{color:C.muted,fontSize:12},caption:{color:C.muted,fontSize:11,lineHeight:18},card:{padding:16,backgroundColor:'white',borderRadius:16,borderWidth:1,borderColor:C.border,gap:12,marginBottom:3},cardTitle:{fontSize:15,fontWeight:'800',color:C.navy},note:{fontSize:13,lineHeight:21,color:'#54697D'},section:{fontSize:17,fontWeight:'800',color:C.navy},label:{alignSelf:'flex-start',paddingVertical:5,paddingHorizontal:10,borderRadius:99},button:{backgroundColor:C.mint,paddingVertical:11,paddingHorizontal:13,borderRadius:11,alignItems:'center',justifyContent:'center'},buttonSecondary:{backgroundColor:C.light},buttonText:{fontSize:12,fontWeight:'800',color:'white'},metricRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:8,borderBottomWidth:1,borderColor:C.bg},between:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:7},plot:{height:158,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',borderBottomWidth:1,borderColor:C.border,marginVertical:10,gap:3},plotCol:{flex:1,height:'100%',justifyContent:'flex-end'},plotBar:{backgroundColor:C.mint,borderTopLeftRadius:3,borderTopRightRadius:3,minHeight:4},action:{paddingBottom:11,borderBottomWidth:1,borderColor:C.border,gap:8},itemTitle:{fontSize:13,fontWeight:'700',color:C.ink},period:{backgroundColor:'white',borderWidth:1,borderColor:C.border,borderRadius:8,paddingVertical:9,paddingHorizontal:12},track:{height:7,borderRadius:6,backgroundColor:C.bg,overflow:'hidden'},progress:{height:7,backgroundColor:C.mint,borderRadius:6},chat:{gap:10,marginVertical:8},bubble:{padding:12,borderRadius:13,maxWidth:'90%'},myBubble:{alignSelf:'flex-end',backgroundColor:C.mint},aiBubble:{alignSelf:'flex-start',backgroundColor:'white',borderWidth:1,borderColor:C.border},suggestions:{flexDirection:'row',gap:6,flexWrap:'wrap'},suggest:{padding:9,borderWidth:1,borderColor:'#BBE4DC',borderRadius:20},input:{flex:1,backgroundColor:'white',borderWidth:1,borderColor:C.border,borderRadius:10,paddingVertical:11,paddingHorizontal:12,minWidth:130,color:C.ink},avatar:{height:42,width:42,borderRadius:22,backgroundColor:C.light,justifyContent:'center',alignItems:'center'},nav:{flexDirection:'row',backgroundColor:'white',borderTopWidth:1,borderColor:C.border,paddingTop:8,paddingBottom:Platform.OS==='ios'?26:12},navItem:{flex:1,alignItems:'center',gap:3,paddingHorizontal:1},navActive:{borderTopColor:C.mint},navText:{fontSize:9,fontWeight:'700'},footer:{fontSize:10,color:C.muted,textAlign:'center',paddingTop:16},error:{color:'#A64C42',fontSize:12},center:{paddingVertical:70,gap:10,alignItems:'center'},modalBack:{flex:1,backgroundColor:'rgba(0,0,0,.42)',justifyContent:'flex-end'},modalCard:{padding:20,paddingBottom:45,backgroundColor:'white',borderTopLeftRadius:24,borderTopRightRadius:24,gap:12,maxHeight:'92%'},choice:{borderWidth:1,borderColor:C.border,padding:11,borderRadius:10},choiceOn:{borderColor:C.mint,backgroundColor:C.light}
});
