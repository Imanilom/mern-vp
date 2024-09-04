function DailyMetric(props) {
    const {dailyMetrics, medianProperty} = props;

    const handleDfaAvg = () => {
        let result = 0;
        let dfaValues = dailyMetrics.map(val => val.dfa);
        dfaValues.forEach(val => {
          result += val
        });
        result = result / dfaValues.length;
        return result.toFixed(2);
      }

    return(
        <div className="mt-8">
        <h4 className="text-lg font-semibold text-gray-800 mb-2">
          Daily Metrics <span className='sm:hidden text-sm'> | this table can be scrolled.</span>
        </h4>

        <div style={{ overflowX: 'auto' }} className='max-w-[350px] sm:max-w-6xl'>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SDNN</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RMSSD</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">pNN50</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S1</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S2</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DFA</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-xs lg:text-[16px]">
              {dailyMetrics.length > 0 ? (
                dailyMetrics.map((metric, index) => {
                  return (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">{metric.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{metric.sdnn !== null ? metric.sdnn.toFixed(2) : 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{metric.rmssd !== null ? metric.rmssd.toFixed(2) : 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{metric.pnn50 !== null ? metric.pnn50.toFixed(2) : 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{metric.s1 !== null ? metric.s1.toFixed(2) : 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{metric.s2 !== null ? metric.s2.toFixed(2) : 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{metric.dfa !== null ? metric.dfa.toFixed(2) : 'N/A'}</td>
                    </tr>
                  );
                })

              ) : null}

            </tbody>
          </table>
        </div>
        <h4 className="text-lg font-semibold text-gray-800 mb-2 mt-4">Average Metrics</h4>
        <div style={{ overflowX: 'auto' }} className='max-w-[350px] sm:max-w-6xl'>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
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
            <tbody className="bg-white divide-y divide-gray-200 text-xs lg:text-[16px]">
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