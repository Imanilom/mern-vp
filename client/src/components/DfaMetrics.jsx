import AOS from 'aos';
import { useEffect, useState } from 'react';

function DfaMetrics(props) {

  const [page, setPage] = useState(0);
  const { results, splittedLog } = props;
  const itemsPerPage = 5;

  // Menghitung data yang ditampilkan berdasarkan halaman
  const paginatedResults = results.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
  console.log({ paginatedResults })
  useEffect(() => {
    AOS.init({
      duration: 700
    })
  }, []);


  console.log({ results });
  console.log('amann')


  const formatTanggal = (tgl_timestamp) => {
    const date = new Date(tgl_timestamp);
    return date.toISOString().split('T')[0];
    // September, 18 2024
  }

  //   const handleDfaAvg = () => {
  //     let result = 0;
  //     let dfaValues = resultss.map(val => val.dfa);
  //     dfaValues.forEach(val => {
  //       result += val
  //     });
  //     result = result / dfaValues.length;
  //     return result.toFixed(2);
  //   }

  return (
    <div className="mt-8" data-aos="fade-right">
      <h4 className="text-lg font-semibold mb-2">
        Metrics DFA <span className='sm:hidden text-sm'></span>
      </h4>

      <div style={{ overflowX: 'auto' }} className='max-w-[350px] sm:max-w-6xl rounded-md'>
        <table className="min-w-full rounded-md">
          <thead className="bg-[#363636]/20 dark:bg-[#217170]">
            <tr className="">
              <th className="px-6 py-4 text-left text-xs whitespace-nowrap font-medium text-gray-500 dark:text-white uppercase tracking-wider">Slide {page + 1}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider"></th>
              <th className="px-6 py-3 text-left text-xs  uppercase tracking-wider text-[#07AC7B] dark:text-[#FFD166] cursor-pointer font-semibold">
                {page > 0 ? (
                  <button onClick={() => setPage(page - 1)}>
                    {'<- '}Before
                  </button>
                ) : null}
              </th>
              <th className="px-6 py-3 text-left text-xs  uppercase tracking-wider text-[#07AC7B] dark:text-[#FFD166] cursor-pointer font-semibold">
                {page < results.length / 5 - 1? (
                  <button onClick={() => setPage(page + 1)}>
                    Next {'->'}
                  </button>
                ) : null}
              </th>
            </tr>
          </thead>
          <thead className="bg-[#2c2c2c] dark:bg-[#E7E7E7]">
            <tr className="">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time start</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time end</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DFA</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="text-xs lg:text-sm">
            {paginatedResults.length > 0 ? (
              paginatedResults.map((metric, index) => {
                return (
                  <tr key={index} className={index % 2 == 1 ? `bg-[#2C2C2C] dark:bg-[#E7E7E7]` : `bg-[#141414] dark:bg-[#CBCBCB]`}>
                    <td className="px-6 py-4 whitespace-nowrap">{index + 1 + page * itemsPerPage}</td>
                    {typeof metric.tanggal == 'string' ? (
                      <td className="px-6 py-4 whitespace-nowrap">{metric.tanggal}</td>
                    ) : (
                      <td className="px-6 py-4 whitespace-nowrap">{formatTanggal(metric.timestamp_tanggal)}</td>
                    ) }
                    <td className="px-6 py-4 whitespace-nowrap">{metric.waktu_awal ?? null}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.waktu_akhir ?? null}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.dfa !== null && metric.dfa ? metric.dfa.toFixed(2) : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{HandleSimbol({ dfa: metric.dfa })}</td>
                  </tr>
                );
              })
            ) : null}
          </tbody>
        </table>
      </div>

    </div>
  )
}

function HandleSimbol(props) {
  const { dfa } = props;
  if (dfa >= 1.5) {
    return (
      <span
        className="w-fit px-3 py-1 text-[12px] rounded-md bg-red-600 text-white font-medium">
        Danger Area
      </span>
    )
  }

  else if (dfa >= 1.2) {
    return (
      <span
        className="w-fit px-3 py-1 text-[12px] rounded-md bg-orange-600 text-white font-medium">
        Warning Area
      </span>

    )
  }

  else if (dfa > 0) {
    return (
      <span
        className="w-fit px-3 py-1 text-[12px] rounded-md bg-green-500 text-white font-medium" >
        Safe Area
      </span>
    )
  }

}

export default DfaMetrics;