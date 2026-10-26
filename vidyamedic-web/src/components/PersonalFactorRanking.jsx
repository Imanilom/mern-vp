import { ListOrdered } from 'lucide-react';
import { rankPersonalReportedFactors } from '../utils/personalFactorRanking';

export default function PersonalFactorRanking({ checkIns = [], compact = false }) {
  const factors = rankPersonalReportedFactors(checkIns);
  return (
    <section className={`panel personal-factor-ranking${compact ? ' compact' : ''}`}>
      <div className="panel-heading">
        <div>
          <h2>Rangking faktor personal</h2>
          <p>Urutan berdasarkan ranking yang Anda isi saat mengonfirmasi event</p>
        </div>
        <span className="panel-icon"><ListOrdered size={18} /></span>
      </div>
      {factors.length ? (
        <ol className="personal-factor-list">
          {factors.map((item, index) => (
            <li key={item.factor}>
              <span className="personal-factor-rank">{index + 1}</span>
              <span className="personal-factor-name">{item.label}</span>
              <span className="personal-factor-evidence">
                Dilaporkan pada {item.events} event · rerata urutan {item.averageRank.toFixed(1)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-state small-empty">
          <strong>Ranking faktor belum tersedia</strong>
          <p>Setelah mengonfirmasi event, urutkan faktor yang Anda rasakan berpengaruh. Sistem tidak membuat ranking tanpa masukan Anda.</p>
        </div>
      )}
      <p className="baseline-footnote">
        Ringkasan laporan subjektif pengguna, bukan atribusi sebab-akibat atau kontribusi statistik.
      </p>
    </section>
  );
}
