import AOS from 'aos';
import { useEffect } from 'react';

function DailyMetric(props) {
  useEffect(() => {
    AOS.init({
      duration: 700
    })
  }, []);
  const { dailyMetrics, medianProperty } = props;
  console.log({ dailyMetrics, medianProperty })
  const handleDfaAvg = () => {
    let result = 0;
    let dfaValues = dailyMetrics.map(val => val.dfa);
    let i = 0;
    dfaValues.forEach(val => {
      if (typeof val == "number") {
        result += val
        i++;
      }
    });
    result = result / i;
    return result.toFixed(2);
  }

  return (
    <div className="mt-8" data-aos="fade-right">
      <h4 className="text-lg font-semibold mb-2">
        Daily Metrics <span className='sm:hidden text-sm'></span>
      </h4>

      <div style={{ overflowX: 'auto' }} className='max-w-[350px] sm:max-w-6xl'>
        <table className="min-w-full rounded-md">
          <thead className="bg-[#363636]/20 dark:bg-[#217170]">
            <tr className="">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">SDNN</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">RMSSD</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">Min</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">Max</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">hf</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">lf</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white  tracking-wider">lfHfRatio</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">DFA</th>
            </tr>
          </thead>
          <tbody className=" text-xs lg:text-sm">
            {dailyMetrics.length > 0 ? (
              dailyMetrics.map((metric, index) => {
                return (
                  <tr key={index} className={index % 2 == 0 ? `bg-[#2C2C2C] dark:bg-[#E7E7E7] text-white dark:text-[#073B4C]` : `bg-[#141414] dark:bg-[#CBCBCB] dark:text-[#073B4C] text-white`}>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.sdnn !== null && metric.hasOwnProperty('sdnn') ? metric.sdnn.toFixed(2) : 'properti kosong.'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.rmssd !== null && metric.hasOwnProperty('rmssd') ? metric.rmssd.toFixed(2) : 'properti kosong.'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.min !== null && metric.hasOwnProperty('min') ? metric.min.toFixed(2) : 'properti kosong.'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.max !== null && metric.hasOwnProperty('max') ? metric.max.toFixed(2) : 'properti kosong.'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.hf !== null && metric.hasOwnProperty('hf') ? metric.hf.toFixed(2) : 'properti kosong.'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.lf !== null && metric.hasOwnProperty('lf') ? metric.lf.toFixed(2) : 'properti kosong.'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.lfHfRatio !== null && metric.hasOwnProperty('lfHfRatio') ? metric.lfHfRatio.toFixed(2) : 'properti kosong.'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.dfa !== null && metric.hasOwnProperty('dfa') ? metric.dfa.toFixed(2) : 'Data tidak mencukupi'}</td>
                  </tr>
                );
              })

            ) : null}

          </tbody>
        </table> 
      </div>
      <h4 className="text-lg font-semibold mb-2 mt-4">Average Metrics</h4>
      <div style={{ overflowX: 'auto' }} className='max-w-[350px] sm:max-w-6xl'>
        <table className="min-w-full ">
          <thead className="bg-[#363636]/20 dark:bg-[#217170]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium dark:text-white text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium dark:text-white text-gray-500 uppercase tracking-wider">SDNN</th>
              <th className="px-6 py-3 text-left text-xs font-medium dark:text-white text-gray-500 uppercase tracking-wider">RMSSD</th>
              <th className="px-6 py-3 text-left text-xs font-medium dark:text-white text-gray-500 uppercase tracking-wider">Min</th>
              <th className="px-6 py-3 text-left text-xs font-medium dark:text-white text-gray-500 uppercase tracking-wider">Max</th>
              <th className="px-6 py-3 text-left text-xs font-medium dark:text-white text-gray-500 uppercase tracking-wider">hf</th>
              <th className="px-6 py-3 text-left text-xs font-medium dark:text-white text-gray-500 uppercase tracking-wider">lf</th>
              <th className="px-6 py-3 text-left text-xs font-medium dark:text-white text-gray-500 uppercase tracking-wider">lfHfRatio</th>
              <th className="px-6 py-3 text-left text-xs font-medium dark:text-white text-gray-500 uppercase tracking-wider">DFA</th>
              {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th> */}
            </tr>
          </thead>
          <tbody className="bg-[#212121] dark:bg-[#E7E7E7] text-xs lg:text-sm">
            {/* {dailyMetrics.map((metric, index) => ( */}
            {dailyMetrics.length > 0 ? (
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">{dailyMetrics[dailyMetrics.length - 1]['date']} - {dailyMetrics[0]['date']} </td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.sdnn.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.rmssd.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.min.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.max.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.hf.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.lf.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.lfHfRatio.toFixed(2)}</td>

                <td className="px-6 py-4 whitespace-nowrap">{handleDfaAvg()}</td>
                {/* <td className="px-6 py-4 whitespace-nowrap">{medianProperty.total}</td> */}
              </tr>
            ) : null}
            {/* ))} */}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DailyMetric;