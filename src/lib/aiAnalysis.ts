import type { TeamProfile, IndividualProfile } from '../types';

export interface AiAnalysisReport {
  summary: string;
  prosAnalysis: string[];
  consAnalysis: string[];
  recommendations: string[];
  trendExplanation: string;
  volatilityExplanation: string;
}

function cleanMetricName(raw: string): string {
  return raw
    .replace(/^(5Scale|SubTotal)_/, '')
    .replace(/_(CSM|CE|SPS)$/, '');
}

const METRIC_EXPLANATIONS: Record<string, { desc: string; impact: string; fix: string }> = {
  MoP: {
    desc: 'ketepatan pencatatan MoP dan input nilai',
    impact: 'kelancaran pencatatan pendapatan perusahaan',
    fix: 'Pastikan catatan MoP dan input penilaian diisi tepat waktu, paling lambat tanggal 3 bulan berikutnya.',
  },
  CostPerRevenue: {
    desc: 'pengendalian biaya operasional dibanding pendapatan',
    impact: 'keuntungan layanan tim',
    fix: 'Jaga pemakaian toner dan drum tetap wajar, hindari stok berlebih, lalu cek ulang pemakaian part secara berkala.',
  },
  CSAT: {
    desc: 'kepuasan pelanggan terhadap layanan',
    impact: 'kepercayaan dan kenyamanan pelanggan',
    fix: 'Cek segera masukan bernilai rendah, tanggapi dengan cepat, dan pastikan masalah pelanggan benar-benar selesai.',
  },
  LWH: {
    desc: 'kecepatan penyelesaian pekerjaan',
    impact: 'jumlah pekerjaan yang bisa diselesaikan dalam sehari',
    fix: 'Siapkan diagnosa sejak awal supaya pengerjaan selesai lebih cepat dan tidak molor.',
  },
  RTSuccessRatio: {
    desc: 'kecepatan merespons permintaan pelanggan',
    impact: 'ketepatan waktu penanganan awal',
    fix: 'Arahkan tiket ke teknisi yang paling dekat dan pantau pergerakannya agar respon lebih cepat.',
  },
  LoL: {
    desc: 'kecepatan menuntaskan tiket yang sudah terbuka',
    impact: 'agar keluhan pelanggan tidak menumpuk',
    fix: 'Pantau tiket yang masih terbuka setiap hari dan segera tindak lanjuti jika sudah mendekati batas waktu.',
  },
  ReturnCons: {
    desc: 'kedisiplinan mengembalikan barang bekas pakai ke gudang',
    impact: 'kerapian stok dan kontrol barang lapangan',
    fix: 'Biasakan mengembalikan barang bekas ke gudang maksimal 1 hari setelah pekerjaan selesai.',
  },
  RTFirstVisit: {
    desc: 'kecepatan kunjungan pertama ke pelanggan',
    impact: 'ketepatan awal pelayanan harian',
    fix: 'Atur rute kunjungan sejak pagi supaya teknisi sampai lebih tepat waktu.',
  },
  WkTS: {
    desc: 'konsistensi waktu kerja sesuai standar',
    impact: 'keteraturan proses kerja dan laporan setelah servis',
    fix: 'Ingatkan teknisi untuk mengisi form setelah servis tepat setelah pekerjaan selesai.',
  },
  TSM: {
    desc: 'berapa sering masalah yang sama muncul lagi',
    impact: 'keandalan mesin pelanggan',
    fix: 'Periksa akar masalahnya sampai tuntas supaya kerusakan tidak muncul berulang.',
  },
  ProductivityCall: {
    desc: 'jumlah pekerjaan yang bisa diselesaikan per hari',
    impact: 'efektivitas kerja harian',
    fix: 'Atur jadwal kerja supaya hari yang sepi bisa dipakai untuk pekerjaan preventif.',
  },
  SupportIT: {
    desc: 'keterlibatan dalam tugas atau proyek non-printing',
    impact: 'kemampuan tim menangani pekerjaan tambahan',
    fix: 'Libatkan tim pada proyek non-printing yang tersedia dan catat datanya dengan rapi.',
  },
  CEComSkill: {
    desc: 'kemampuan komunikasi teknisi',
    impact: 'cara teknisi berinteraksi dengan pelanggan',
    fix: 'Daftarkan anggota yang belum ikut pelatihan komunikasi ke program yang tersedia.',
  },
};

export function generateAiAnalysis(profile: TeamProfile): AiAnalysisReport {
  const { mpg, avgTotalOverall, rank, trend, volatility, pros, cons } = profile;
  const lastStat = profile.periodStats[profile.periodStats.length - 1];
  const memberCount = lastStat?.memberCount ?? 0;

  // 1. Executive Summary
  let summary = '';
  const trendText =
    trend.direction === 'up'
      ? `lagi naik sebesar +${trend.deltaPct.toFixed(1)}% dalam beberapa periode terakhir.`
      : trend.direction === 'down'
        ? `sedang turun sebesar -${Math.abs(trend.deltaPct).toFixed(1)}% dan perlu perhatian.`
        : `cukup stabil, dengan perubahan sekitar ${trend.deltaPct.toFixed(1)}%.`;

  if (rank <= 5) {
    summary = `Tim ${mpg} termasuk kelompok terbaik (#${rank}) dengan rata-rata skor ${avgTotalOverall.toFixed(2)}. Tim ini ${trendText} Secara umum, tim sudah bekerja rapi dan bisa dijadikan contoh untuk tim lain.`;
  } else if (rank > 5 && rank <= 15) {
    summary = `Tim ${mpg} ada di kelompok tengah (peringkat #${rank}) dengan rata-rata skor ${avgTotalOverall.toFixed(2)}. Performa tim ${trendText} Masih ada beberapa bagian yang bisa dirapikan supaya hasilnya naik lagi.`;
  } else {
    summary = `Tim ${mpg} masih perlu perhatian (peringkat #${rank}) dengan rata-rata skor ${avgTotalOverall.toFixed(2)}. Performa tim ${trendText} Perlu dilihat lagi bagian mana yang paling menghambat kerja di lapangan.`;
  }

  // 2. Pros Analysis
  const prosAnalysis: string[] = [];
  pros.forEach((p) => {
    const clean = cleanMetricName(p.metric);
    const meta = METRIC_EXPLANATIONS[clean];
    if (meta) {
      prosAnalysis.push(
        `${clean} (${meta.desc}): lebih baik +${p.deltaFromMean.toFixed(2)} dari rata-rata. Ini membantu ${meta.impact}.`
      );
    } else {
      prosAnalysis.push(
        `${clean}: lebih baik +${p.deltaFromMean.toFixed(2)} dari rata-rata.`
      );
    }
  });

  // 3. Cons Analysis
  const consAnalysis: string[] = [];
  cons.forEach((c) => {
    const clean = cleanMetricName(c.metric);
    const meta = METRIC_EXPLANATIONS[clean];
    if (meta) {
      consAnalysis.push(
        `${clean} (${meta.desc}): masih ${c.deltaFromMean.toFixed(2)} di bawah rata-rata. Ini bisa mengganggu ${meta.impact}.`
      );
    } else {
      consAnalysis.push(
        `${clean}: masih ${c.deltaFromMean.toFixed(2)} di bawah rata-rata.`
      );
    }
  });

  // 4. Recommendations
  const recommendations: string[] = [];
  
  // Specific recommendations based on weaknesses
  cons.forEach((c) => {
    const clean = cleanMetricName(c.metric);
    const meta = METRIC_EXPLANATIONS[clean];
    if (meta) {
      recommendations.push(meta.fix);
    }
  });

  // General trend/composition based recommendations
  if (trend.direction === 'down') {
    recommendations.push(
      'Lakukan evaluasi bersama CSM dan tim supaya penyebab turunnya performa bisa ketahuan lebih cepat.'
    );
  }
  if (lastStat && lastStat.pctSERPO > 70) {
    recommendations.push(
      'Karena sebagian besar tim ada di SERPO, koordinasi online dan pantauan jarak jauh perlu dibuat lebih rutin.'
    );
  }
  if (memberCount > 15 && avgTotalOverall < 3.5) {
    recommendations.push(
      'Tim cukup besar, jadi pembagian tugas atau kelompok kecil bisa membantu pengawasan jadi lebih fokus.'
    );
  }

  // Fallback if no specific recommendations
  if (recommendations.length === 0) {
    recommendations.push(
      'Pertahankan cara kerja yang sudah bagus sekarang dan tetap pantau hasilnya tiap bulan.'
    );
  }

  // 5. Trend Explanation
  let trendExplanation = '';
  const diffPct = Math.abs(trend.deltaPct).toFixed(1);
  if (trend.direction === 'up') {
    trendExplanation = `Skor rata-rata tim ini naik sebesar ${diffPct}% dibanding awal periode. Artinya, hasil kerja tim sedang membaik.`;
  } else if (trend.direction === 'down') {
    trendExplanation = `Skor rata-rata tim ini turun sebesar ${diffPct}% dibanding awal periode. Artinya, ada bagian yang perlu segera dicek.`;
  } else {
    trendExplanation = `Skor rata-rata tim ini cenderung stabil, dengan perubahan sekitar ${diffPct}%. Hasil kerjanya relatif konsisten.`;
  }

  // 6. Volatility Explanation
  let volatilityExplanation = '';
  const volVal = volatility.toFixed(3);
  if (volatility < 0.15) {
    volatilityExplanation = `Angka fluktuasi rendah (${volVal}). Artinya, hasil kerja tim cukup stabil dari bulan ke bulan.`;
  } else if (volatility < 0.30) {
    volatilityExplanation = `Angka fluktuasi sedang (${volVal}). Naik-turunnya masih wajar dan belum terlalu mengganggu.`;
  } else {
    volatilityExplanation = `Angka fluktuasi tinggi (${volVal}). Hasil kerja tim masih sering naik-turun dan perlu dirapikan supaya lebih stabil.`;
  }

  return {
    summary,
    prosAnalysis,
    consAnalysis,
    recommendations: [...new Set(recommendations)].slice(0, 4),
    trendExplanation,
    volatilityExplanation,
  };
}

export function generateIndividualAiAnalysis(profile: IndividualProfile): AiAnalysisReport {
  const { npk, nama, jabatanUtama, avgTotalOverall, rankInPeerGroup, trend, volatility, pros, cons, hasMutasi } = profile;

  // 1. Executive Summary
  let summary = '';
  const trendText =
    trend.direction === 'up'
      ? `lagi naik sebesar +${trend.deltaPct.toFixed(1)}% dalam beberapa periode terakhir.`
      : trend.direction === 'down'
        ? `sedang turun sebesar -${Math.abs(trend.deltaPct).toFixed(1)}% dan perlu perhatian.`
        : `cukup stabil, dengan perubahan sekitar ${trend.deltaPct.toFixed(1)}%.`;

  if (rankInPeerGroup <= 5) {
    summary = `Karyawan ${nama} (NPK ${npk}) termasuk yang terbaik di jabatan ${jabatanUtama} (peringkat #${rankInPeerGroup}) dengan rata-rata skor ${avgTotalOverall.toFixed(2)}. Kinerjanya ${trendText} Hasil ini layak dipertahankan dan bisa jadi contoh buat rekan lain.`;
  } else if (rankInPeerGroup > 5 && rankInPeerGroup <= 20) {
    summary = `Karyawan ${nama} (NPK ${npk}) ada di kelompok menengah atas (peringkat #${rankInPeerGroup} di jabatan ${jabatanUtama}) dengan rata-rata skor ${avgTotalOverall.toFixed(2)}. Kinerjanya ${trendText} Secara umum sudah bagus, tinggal ada beberapa bagian kecil yang bisa dibenahi.`;
  } else {
    summary = `Karyawan ${nama} (NPK ${npk}) masih perlu pembinaan (peringkat #${rankInPeerGroup} di jabatan ${jabatanUtama}) dengan rata-rata skor ${avgTotalOverall.toFixed(2)}. Kinerjanya ${trendText} Perlu pendampingan agar bagian yang lemah bisa segera membaik.`;
  }

  // 2. Pros Analysis
  const prosAnalysis: string[] = [];
  pros.forEach((p) => {
    const clean = cleanMetricName(p.metric);
    const meta = METRIC_EXPLANATIONS[clean];
    if (meta) {
      prosAnalysis.push(
        `${clean} (${meta.desc}): lebih baik +${p.deltaFromMean.toFixed(2)} dari rata-rata kelompok sejenis. Ini membantu ${meta.impact}.`
      );
    } else {
      prosAnalysis.push(
        `${clean}: lebih baik +${p.deltaFromMean.toFixed(2)} dari rata-rata kelompok sejenis.`
      );
    }
  });

  // 3. Cons Analysis
  const consAnalysis: string[] = [];
  cons.forEach((c) => {
    const clean = cleanMetricName(c.metric);
    const meta = METRIC_EXPLANATIONS[clean];
    if (meta) {
      consAnalysis.push(
        `${clean} (${meta.desc}): masih ${c.deltaFromMean.toFixed(2)} di bawah rata-rata kelompok sejenis. Ini bisa mengganggu ${meta.impact}.`
      );
    } else {
      consAnalysis.push(
        `${clean}: masih ${c.deltaFromMean.toFixed(2)} di bawah rata-rata kelompok sejenis.`
      );
    }
  });

  // 4. Recommendations
  const recommendations: string[] = [];
  
  // Specific recommendations based on weaknesses
  cons.forEach((c) => {
    const clean = cleanMetricName(c.metric);
    const meta = METRIC_EXPLANATIONS[clean];
    if (meta) {
      recommendations.push(meta.fix);
    }
  });

  // General trend/mutation based recommendations
  if (trend.direction === 'down') {
    recommendations.push(
      'Buat sesi coaching langsung dengan CSM supaya penyebab penurunan performa bisa dibahas satu per satu.'
    );
  }
  if (hasMutasi) {
    recommendations.push(
      'Karena baru mutasi, pantau penyesuaian kerjanya secara berkala di tempat baru.'
    );
  }
  if (volatility >= 0.3) {
    recommendations.push(
      'Karena hasil kerja masih naik-turun, fokus perbaikan ada pada rutinitas kerja harian dan cara melayani pelanggan.'
    );
  }

  // Fallback if no specific recommendations
  if (recommendations.length === 0) {
    recommendations.push(
      'Pertahankan pencapaian saat ini dan beri kesempatan ikut pelatihan tambahan bila diperlukan.'
    );
  }

  // 5. Trend Explanation
  let trendExplanation = '';
  const diffPct = Math.abs(trend.deltaPct).toFixed(1);
  if (trend.direction === 'up') {
    trendExplanation = `Skor bulanan personil ini naik sebesar ${diffPct}% dibanding awal periode. Artinya, kinerjanya sedang membaik.`;
  } else if (trend.direction === 'down') {
    trendExplanation = `Skor bulanan personil ini turun sebesar ${diffPct}% dibanding awal periode. Artinya, ada hal yang perlu segera dicek.`;
  } else {
    trendExplanation = `Skor bulanan personil ini cenderung stabil, dengan perubahan sekitar ${diffPct}%. Kinerjanya cukup konsisten.`;
  }

  // 6. Volatility Explanation
  let volatilityExplanation = '';
  const volVal = volatility.toFixed(3);
  if (volatility < 0.15) {
    volatilityExplanation = `Angka fluktuasi rendah (${volVal}). Hasil kerja bulanan cukup stabil dan tidak banyak berubah.`;
  } else if (volatility < 0.30) {
    volatilityExplanation = `Angka fluktuasi sedang (${volVal}). Naik-turunnya masih tergolong wajar.`;
  } else {
    volatilityExplanation = `Angka fluktuasi tinggi (${volVal}). Hasil kerja masih sering berubah-ubah dan perlu dibuat lebih konsisten.`;
  }

  return {
    summary,
    prosAnalysis,
    consAnalysis,
    recommendations: [...new Set(recommendations)].slice(0, 4),
    trendExplanation,
    volatilityExplanation,
  };
}
