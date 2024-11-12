import AOS from 'aos';
import { useEffect } from 'react';

function DailyMetric(props) {
  useEffect(() => {
    AOS.init({
      duration: 700
    })
  }, []);
  const { dailyMetrics, medianProperty } = props;
  console.log({ dailyMetrics })
  const handleDfaAvg = () => {
    let result = 0;
    let dfaValues = dailyMetrics.map(val => val.dfa);
    let i = 0;
    dfaValues.forEach(val => {
      if(typeof val == "number"){
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

      <div  style={{ overflowX: 'auto' }} className='max-w-[350px] sm:max-w-6xl'>
        <table className="min-w-full rounded-md">
          <thead className="bg-[#363636]/20">
            <tr className="">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SDNN</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RMSSD</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">pNN50</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S1</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S2</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DFA</th>
            </tr>
          </thead>
          <tbody className=" text-xs lg:text-sm">
            {dailyMetrics.length > 0 ? (
              dailyMetrics.map((metric, index) => {
                return (
                  <tr key={index} className={index % 2 == 0 ? `bg-[#2C2C2C]` : `bg-[#141414]`}>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.sdnn !== null && metric.hasOwnProperty('sdnn') ? metric.sdnn.toFixed(2) : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.rmssd !== null && metric.hasOwnProperty('rmssd') ? metric.rmssd.toFixed(2) : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.pnn50 !== null && metric.hasOwnProperty('pnn50') ? metric.pnn50.toFixed(2) : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.s1 !== null && metric.hasOwnProperty('s1') ?  metric.s1.toFixed(2) : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{metric.s2 !== null && metric.hasOwnProperty('s2') ? metric.s2.toFixed(2) : 'N/A'}</td>
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
          <thead className="bg-[#363636]/20">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SDNN</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RMSSD</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">pNN50</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S1</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S2</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DFA</th>
              {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th> */}
            </tr>
          </thead>
          <tbody className="bg-[#212121] text-xs lg:text-sm">
            {/* {dailyMetrics.map((metric, index) => ( */}
            {dailyMetrics.length > 0 ? (
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">{dailyMetrics[dailyMetrics.length - 1]['date']} - {dailyMetrics[0]['date']} </td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.sdnn.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.rmssd.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.pnn50.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.s1.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{medianProperty.s2.toFixed(2)}</td>
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