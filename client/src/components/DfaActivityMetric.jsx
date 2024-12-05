import AOS from 'aos';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';

function DfaActivityMetric(props) {

    const [page, setPage] = useState(0);
    const { results } = props;
    const itemsPerPage = 5;
    const [popup, setPopup] = useState(false);

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

    const SetDetailData = (data) => {
        console.log({ data })
        const content = `
    <div style="text-align: left;">
       
       <div style="max-width: 50vw; max-height: 40vh; overflow-y: auto;">
        
        <table class="mt-3" style="width: 100%; border-collapse: collapse;">
            <tr class="pb-4 border-b">
                <td class="text-sm" style="padding: 5px;">Label</td>
                <td class="text-sm " style="padding: 5px;">Isi Data</td>
                <td class="text-sm " style="padding: 5px;">Total Metric detail: 14</td>
            </tr>
            <tr class="pt-3">
                <td class="text-sm" style="padding: 5px;">Tanggal:</td>
                <td class="text-sm " style="padding: 5px;">${data.tanggal ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">Aktivitas:</td>
                <td class="text-sm " style="padding: 5px;">${data.aktivitas ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">dfa:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.dfa ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">adfa_alphaPlus:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.adfa.alphaPlus ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">adfa_alphaMinus:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.adfa.alphaMinus ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">hf:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.hf ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">lf:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.lf ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">lfHfRatio:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.lfHfRatio ?? "Data Kosong"} </td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">max:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.max ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">mean:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.mean ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">median3dp:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.median3dp ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">min:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.min ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">rmssd:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.rmssd ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">s1:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.s1 ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">s2:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.s2 ?? "Data Kosong"}</td>
            </tr>
            <tr>
                <td class="text-sm" style="padding: 5px;">sdnn:</td>
                <td class="text-sm " style="padding: 5px;">${data.metrics.sdnn ?? "Data Kosong"}</td>
            </tr>
            
        </table>
       
         </div>
    </div>
`;
        Swal.fire({
            title: '<div class="text-[18px] font-semibold">Detail Information Data</div>',
            html: content,
            width: '600px',
            background: '#f9f9f9',
            showCloseButton: true,
            confirmButtonText: '<i class="fa fa-thumbs-up"></i> Close',
            confirmButtonColor: '#217170',
            customClass: {
                popup: 'shadow-lg rounded'
            }
        });
    }


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
                Metrics DFA Activity <span className='sm:hidden text-sm'></span>
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
                                {page < results.length / 5 - 1 ? (
                                    <button onClick={() => setPage(page + 1)}>
                                        Next {'->'}
                                    </button>
                                ) : null}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider"></th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider"></th>
                        </tr>
                    </thead>
                    <thead className="bg-[#2c2c2c] dark:bg-[#E7E7E7]">
                        <tr className="">
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No.</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktivitas</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DFA</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">alphaPlus</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">alphaMinus</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs lg:text-sm">
                        {paginatedResults.length > 0 ? (
                            paginatedResults.map((metric, index) => {
                                return (
                                    <tr key={index} className={index % 2 == 1 ? `bg-[#2C2C2C] dark:bg-[#E7E7E7]` : `bg-[#141414] dark:bg-[#CBCBCB]`}>
                                        <td className="px-6 py-4 whitespace-nowrap">{index + 1 + page * itemsPerPage}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{metric.tanggal}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{metric.aktivitas}</td>

                                        <td className="px-6 py-4 whitespace-nowrap">{metric.metrics.dfa !== null && metric.metrics.dfa ? metric.metrics.dfa.toFixed(2) : 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{metric.metrics.adfa.alphaPlus !== null && metric.metrics.adfa.alphaPlus ? metric.metrics.adfa.alphaPlus.toFixed(2) : 'properti kosong.'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{metric.metrics.adfa.alphaMinus !== null && metric.metrics.adfa.alphaMinus ? metric.metrics.adfa.alphaMinus.toFixed(2) : 'properti kosong.'}</td>
                                        {/* <td className="px-6 py-4 whitespace-nowrap">{metric.waktu_akhir ?? null}</td> */}
                                        {/* <td className="px-6 py-4 whitespace-nowrap">{metric.dfa !== null && metric.dfa.alpha1 ? metric.dfa.alpha1.toFixed(2) : 'N/A'}</td> */}
                                        {/* <td className="px-6 py-4 whitespace-nowrap">{metric.dfa !== null && metric.dfa.alpha2 ? metric.dfa.alpha2.toFixed(2) : 'N/A'}</td> */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex gap-1">
                                                {HandleSimbol({ dfa: metric.metrics.dfa, name: "Dfa" })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button onClick={() => SetDetailData(metric)} className="px-4 py-2 rounded-md text-xs dark:bg-[#217170] text-white bg-[#07AC7B] font-semibold">Lihat Detail</button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : null}
                    </tbody>
                </table>
            </div>

        </div>
    )
    return (<></>)
}

function HandleSimbol(props) {
    const { dfa, name } = props;
    if (dfa >= 1.5) {
        return (
            <span
                className="w-fit px-3 text-xs py-1 text-[12px] rounded-md bg-red-600 text-white font-medium">
                Danger {name}
            </span>
        )
    }

    else if (dfa >= 1.2) {
        return (
            <span
                className="w-fit text-xs px-3 py-1 text-[12px] rounded-md bg-orange-600 text-white font-medium">
                Warning {name}
            </span>

        )
    }

    else if (dfa > 0) {
        return (
            <span
                className="w-fit text-xs px-3 py-1 text-[12px] rounded-md bg-green-500 text-white font-medium" >
                Safe {name}
            </span>
        )
    }
}

export default DfaActivityMetric;