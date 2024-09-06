import { Line } from "react-chartjs-2";
import { Scatter } from "react-chartjs-2";

function GrafikMetric(props) {

    const { logs, isHRVisible, isRRVisible, isPoincareVisible, borderColor } = props;

    console.log('Pesan dari grafikMetric ', {logs, borderColor}, borderColor.reverse())
    const chartData = (label, dataKey) => {
        return ({
            labels: logs ? logs.map(item => formatDate(item.timestamp)).reverse() : [],
            datasets: [
                {
                    label,
                    data: logs ? logs.map(item => item[dataKey]).reverse() : [],
                    borderColor: borderColor.length > 0 ? borderColor.reverse() : [],
                    borderWidth: 1,
                    fill: true,
                },
            ],
        })
    };

    const poincareData = () => {
        if (!logs) return { datasets: [] };

        const rr = logs.map(item => item.RR);
        const data = rr.slice(1).map((value, index) => ({
            x: rr[index],
            y: value,
        }));

        return {
            datasets: [
                {
                    label: 'Poincare Plot',
                    data,
                    backgroundColor: 'rgba(75, 192, 192, 1)',
                    pointRadius: 2,
                },
            ],
        };
    };

    const formatDate = (unixTimestamp) => {
        const date = new Date(unixTimestamp * 1000); // Convert to milliseconds
        return date.toLocaleString(); // Adjust the format as needed
    };

    return (
        <div>
            {isHRVisible ? (
                <div style={{ overflowX: 'auto' }}>
                    <div className="min-w-[768px] max-w-[768px] min-h-[384px] max-h-[384px] lg:max-w-full mt-4 lg:flex lg:items-center">
                        {isHRVisible && <ChartComponent data={chartData('HR', 'HR')} />}
                    </div>
                </div>
            ) : null}

            {isRRVisible ? (
                <div style={{ overflowX: 'auto' }}>
                    <div className="min-w-[768px] max-w-[768px] min-h-[384px] max-h-[384px] mt-4 lg:flex lg:items-center">
                        {isRRVisible && <ChartComponent data={chartData('RR', 'RR')} />}
                    </div>
                </div>
            ) : null}

            {isPoincareVisible ? (
                <div style={{ overflowX: 'auto' }}>
                    <div className="min-w-[768px] max-w-[768px] min-h-[384px] max-h-[384px] mt-4 lg:flex lg:items-center">
                        {isPoincareVisible && <ScatterChartComponent data={poincareData()} />}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default GrafikMetric;

const ChartComponent = ({ data }) => (
    // <div style={{ overflowX: 'auto' }} className='max-w-[350px] sm:max-w-6xl'>
    <div className="object-cover w-full lg:w-full rounded-xl h-96">
        <Line data={data} />
    </div>
    // </div>
);


const ScatterChartComponent = ({ data }) => (
    <div className="object-cover w-full lg:w-full rounded-xl h-96">
        <Scatter data={data} />
    </div>
);
