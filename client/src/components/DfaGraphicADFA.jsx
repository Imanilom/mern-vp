import { useRef, useState, useEffect } from 'react';

import * as d3 from 'd3';
import { FaAngleLeft } from "react-icons/fa";
import { FaAngleRight } from "react-icons/fa";
import '../chart.css';
import AOS from 'aos';


let scroolState = {
    HR: 1, // daftarkan label 
    RR: 1,
    DFA: 1
};

function DfaGraphicADFA({ data, label, keyValue, color }) {

    const [scroolLevel, setScroolLevel] = useState(1);
    const chartRef = useRef();
    const [slice, setSlice] = useState(1);
    const [slider, setSlider] = useState(1);
    const XCount = 5;

    const formatedDate = (date) => {
        // console.log({ date })
        if (typeof date == 'string') {
            const [d, m, y] = date.split('-');
            console.log(`${y}-${m}-${d}`)
            return `${y}-${m}-${d}`;
        } else {
            return date;
        }
    }

    useEffect(() => {
        AOS.init({
            duration: 700
        })
    }, [])

    let styleTooltype = {
        position: 'absolute',
        pointerEvents: 'none',
        background: 'rgba(0, 0, 0, 0.7)',
        color: '#fff',
        padding: 5 + 'px',
        borderRadius: 3 + 'px',
        opacity: 0,
        transition: 'opacity 0.2s',
        fontSize: 12 + 'px',
        maxWidth: 300 + 'px',
        minWidth: 200 + 'px',
        zIndex: 99
    }

    useEffect(() => {

        drawChart(data);
    }, [data])

    function simulateScroll(left) {
        const container = document.getElementById(`svg-container-${label}`);
        container.scrollLeft = left;
    }

    const triggerSimulate = (opt) => {
        if (opt == 'plus' && scroolState[label] < slice) {
            scroolState[label]++;
            setSlider(slider + 1);
            drawChart(data);
            // console.log('plus..')
            // simulateScroll(768 * (scroolState[label] - 1))
        } else if (opt == 'decrement' && scroolState[label] > 1) {
            setSlider(slider - 1);
            scroolState[label]--;
            drawChart(data)
            // console.log('decrement..')
            // simulateScroll((768 * (scroolState[label] - 1)));
        }
    }


    data.forEach(d => {

        const dateStr = new Date(d.timestamp_tanggal);

        if (typeof d.tanggal != 'object') {
            d.tanggal = dateStr // Update tanggal agar mengikuti waktu_awal
        }

        let statusA1 = 'Safe';
        let statusA2 = 'Safe';

        if (d.adfa.alphaPlus > 1.2) statusA1 = 'Warning'
        if (d.adfa.alphaPlus > 1.5) statusA1 = 'Danger'

        if (d.adfa.alphaMinus > 1.2) statusA2 = 'Warning'
        if (d.adfa.alphaMinus > 1.5) statusA2 = 'Danger'

        d.statusA1 = statusA1;
        d.statusA2 = statusA2;
        // console.log(d.tanggal);
    });

    // console.log({ data })

    const changeZoomText = (zoomV) => {
        document.getElementById(`zoom_panel_${label}`).innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
    }

    const drawChart = (rawData) => {
        // console.log({rawData})
        let processedData2 = rawData.filter(d => d.dfa !== null);
        processedData2.sort((a, b) => a.tanggal - b.tanggal)
        console.log(processedData2.length);

        // lakukan pengelompokan data sesuai hari
        const logsGroupDate = {};
        let date = "";
        let result = [];

        // Mengelompokkan data berdasarkan tanggal
        // console.log({ processedData2 })
        processedData2.forEach((val) => {
            const dateObj = new Date(val.timestamp_tanggal);
            if (dateObj.getMonth() + 1 > 9) {
                date = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}`;
            } else {
                date = `${dateObj.getFullYear()}-0${dateObj.getMonth() + 1}-${dateObj.getDate()}`;
            }
            // const [y,m,d] = date.split("") 
            if (!logsGroupDate[date]) logsGroupDate[date] = [];
            logsGroupDate[date].push(val);
        });

        console.log({ logsGroupDate });

        // Proses data per tanggal
        Object.entries(logsGroupDate).forEach(([date, val]) => {
            let labelingMinute = ["00", "15", "30", "45"];
            let labelingHour = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));

            let startDataTimeHour = val[0].waktu_awal.split('.')[0];
            let endDataTimeHour = val[val.length - 1].waktu_akhir.split('.')[0];

            console.log({ val, startDataTimeHour, endDataTimeHour });

            // Menambahkan waktu awal
            for (let hour = 0; hour < startDataTimeHour; hour++) {
                labelingMinute.forEach((minute) => {
                    let datetime = new Date(`${date}T${labelingHour[hour]}:${minute}:00`);
                    result.push({
                        // HR: 0,
                        // RR: 0,
                        // create_at: datetime,
                        // label: "safe",
                        // timestamp: datetime.getTime(),
                        adfa: {
                            alphaPlus: 0,
                            alphaMinus: 0
                        },
                        aktivitas: "Uknown",
                        count: 0,
                        dfa: {
                            alpha1: 0,
                            alpha2: 0,
                        },
                        statusA1: "Safe",
                        statusA2: "Safe",
                        tanggal: datetime,
                        timestamp_tanggal: datetime.getTime(),
                        waktu_akhir: `${labelingHour[hour]}:${parseInt(minute) + 15}:00`,
                        waktu_awal: `${labelingHour[hour]}:${minute}:00`
                    });
                });
            }

            // Menambahkan data asli
            val.forEach((data) => result.push(data));
            console.log({ date, val })

            // Menambahkan waktu akhir
            for (let hour = endDataTimeHour; hour < labelingHour.length; hour++) {
                labelingMinute.forEach((minute) => {
                    let datetime = new Date(`${date}T${labelingHour[hour]}:${minute}:00`);
                    result.push({
                        // HR: 0,
                        // RR: 0,
                        // create_at: datetime,
                        // label: "safe",
                        // timestamp: datetime.getTime(),
                        adfa: {
                            alphaPlus: 0,
                            alphaMinus: 0
                        },
                        aktivitas: "Uknown",
                        count: 0,
                        dfa: {
                            alpha1: 0,
                            alpha2: 0,
                        },
                        statusA1: "Safe",
                        statusA2: "Safe",
                        tanggal: datetime,
                        timestamp_tanggal: datetime.getTime(),
                        waktu_akhir: `${labelingHour[hour]}:${parseInt(minute) + 15}:00`,
                        waktu_awal: `${labelingHour[hour]}:${minute}:00`
                    });
                });
            }

        });

        // Mengurutkan data berdasarkan waktu
        result.sort((a, b) => new Date(a.create_at) - new Date(b.create_at));
        console.log({ result });

        //   let processedData = result;

        let page = scroolState[label] - 1;
        let maxTitik = 20;

        // Fungsi untuk mendapatkan data sesuai dengan halaman
        function getPaginatedData(data, page, maxTitik) {
            const startIndex = page * maxTitik;
            const endIndex = startIndex + maxTitik;
            return data.slice(startIndex, endIndex);
        }

        // Mendapatkan data yang diproses untuk halaman saat ini
        const paginatedData = getPaginatedData(result, page, maxTitik);
        let processedData = paginatedData;

        processedData.map((val) => {
            if (val.adfa.alphaPlus == null) val.adfa.alphaPlus = 0;
            if (val.adfa.alphaMinus == null) val.adfa.alphaMinus = 0;
        })

        
        console.log({ processedData, page, maxTitik })

        let defaultColor = "rgba(7, 172, 123, 1)";

        const theme = localStorage.getItem('_isLightMode');
        if (theme == "true") { // is light state
            defaultColor = "rgba(33,113,122, 1)";
        }
        
        let colorA1 = processedData.map((item, i) => {
            if (i > 0) {
              
                if (processedData[i - 1].adfa.alphaPlus - processedData[i].adfa.alphaPlus >= 10) {
              
                    return 'rgba(249, 39, 39, 0.8)';
                } else if (processedData[i - 1].adfa.alphaPlus - processedData[i].adfa.alphaPlus >= 5) {
                    
                    return 'rgba(255, 161, 0, 1)';
                } else {
                    return 'rgba(0, 90, 143, 1)'; // Warna default
                }
            } else {
                return 'rgba(0, 90, 143, 1)'; // Warna default
            }
        });

        let colorA2 = processedData.map((item, i) => {
            if (i > 0) {
              
                if (processedData[i - 1].adfa.alphaMinus - processedData[i].adfa.alphaMinus >= 10) {
              
                    return 'rgba(249, 39, 39, 0.8)';
                } else if (processedData[i - 1].adfa.alphaMinus - processedData[i].adfa.alphaMinus >= 5) {
                    
                    return 'rgba(255, 161, 0, 1)';
                } else {
                    return defaultColor; // Warna default
                }
            } else {
                return defaultColor; // Warna default
            }
        });

        let sizeCircleA1 = processedData.map((item, i) => {
            if (i > 0) {
               
                if (processedData[i - 1].adfa.alphaPlus - processedData[i].adfa.alphaPlus >= 10) {
                   
                    processedData[i]['label'] = "Danger";
                    return 8; // ukuran 6 untuk damger
                } else if (processedData[i - 1].adfa.alphaPlus - processedData[i].adfa.alphaPlus >= 5) {
                    processedData[i]['label'] = "Warning";
                    // console.log('oke kuning')
                    return 6;
                } else {
                    processedData[i]['label'] = "Safe";
                    return 4; // Warna default
                }
            } else {
                processedData[i]['label'] = "Safe";
                return 4; // Warna default
            }
        })

        let sizeCircleA2 = processedData.map((item, i) => {
            if (i > 0) {
               
                if (processedData[i - 1].adfa.alphaMinus - processedData[i].adfa.alphaMinus >= 10) {
                   
                    processedData[i]['label'] = "Danger";
                    return 8; // ukuran 6 untuk damger
                } else if (processedData[i - 1].adfa.alphaMinus - processedData[i].adfa.alphaMinus >= 5) {
                    processedData[i]['label'] = "Warning";
                    // console.log('oke kuning')
                    return 6;
                } else {
                    processedData[i]['label'] = "Safe";
                    return 4; // Warna default
                }
            } else {
                processedData[i]['label'] = "Safe";
                return 4; // Warna default
            }
        });


        // mengambil element tooltip
        const tooltip = d3.select(`#tooltip${label}-adfa`);
        const lastSvg = d3.select(chartRef.current);
        lastSvg.selectAll('*').remove()

        const height = 500;
        let width = 678;
        // let width = (34 * processedData.length) + 30;
        // let width = rawData.length * 70;
        // if (rawData.length > 10) {
        //     width = rawData.length * 50;
        // }
        const margin = { top: 20, right: 20, bottom: 90, left: 50 };
        let svgWidth;

        if (window.innerWidth > 980) {
            svgWidth = 768;
        } else if (window.innerWidth > 540) {
            svgWidth = window.innerWidth * 0.7;
        } else {

            svgWidth = window.innerWidth * 0.8;
        }

        setSlice(Math.floor(result.length / maxTitik) + 1);

     
        const svg = d3.select(chartRef.current)
            .append('svg')
            .attr('height', height)
            .attr('width', width)
            .attr('class', 'svgOne bg-[#101010] dark:bg-[#FEFCF5] min-w-lg')

        // const x = d3.scaleBand()
        //     .domain(processedData.map(d => d.tanggal))
        //     .range([margin.left, width - margin.right]);

        const x = d3.scaleBand()
            .domain(processedData.map(d => d.tanggal))
            .range([margin.left, width - margin.right])
            .padding(0.05);  // Kurangi padding agar lebih banyak label ditampilkan

        const y = d3.scaleLinear()
            .domain([0, d3.max(processedData, d => Math.max(d.adfa.alphaPlus, d.adfa.alphaMinus)) + 0.2])
            .range([height - margin.bottom, margin.top]);

        // const line = d3.line()
        //     .x(d => x(d.tanggal))
        //     .y(d => y(d[[keyValue]]));

        const lineA1 = d3.line()
            .x(d => x(d.tanggal))
            .y(d => y(d.adfa.alphaPlus));

        const lineA2 = d3.line()
            .x(d => x(d.tanggal))
            // .y(d => y(d[["dfa"]?.alpha2]));
            .y(d => y(d.adfa.alphaMinus));

        // svg.append('path')
        //     .datum(processedData)
        //     .attr('fill', 'none')
        //     .attr('stroke', color[0])
        //     .attr('stroke-width', 2)
        //     .attr('d', line);

        processedData.forEach(d => {
            if (!d.tanggal || isNaN(d.adfa?.alphaPlus) || isNaN(d.adfa?.alphaMinus)) {
                console.error('Invalid data:', d);
            }

            console.log(d.adfa)
        });

        // console.log({ defaultColor, lineA1, lineA2 }, paginatedData[0][keyValue].alpha1)

        let linePathA1 = svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(0, 90, 143, 1)')
            .attr('stroke-width', 2)
            .attr('d', lineA1);

        let linePathA2 = svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(75, 192, 192, 1)')
            .attr('stroke-width', 2)
            .attr('d', lineA2);

        // Deteksi perubahan tanggal
        let previousDate = null;

        processedData.forEach((d, i) => {
            // console.log({ d }, 'DfaGraphic');
            const currentDate = d.tanggal.toDateString();
            if (previousDate !== currentDate) {
                // Gambar garis putus-putus di sini
                svg.append('line')
                    .attr('x1', x(d.tanggal)) // Posisi X berdasarkan tanggal
                    .attr('y1', margin.top)
                    .attr('x2', x(d.tanggal)) // Posisi X untuk garis vertikal
                    .attr('y2', height - margin.bottom)
                    .attr('stroke', theme == "true" ? "gray" : "white")
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '5,5'); // Mengatur garis menjadi putus-putus

                // Tambahkan label tanggal di dekat garis putus-putus
                svg.append('text')
                    .attr('x', x(d.tanggal) + 5)
                    .attr('y', margin.top - 5)
                    .attr('fill', theme == "true" ? "gray" : "white")
                    .attr('font-size', 10)
                    .text(currentDate);
            }
            previousDate = currentDate;
        });

        // Memberikan titik pada ujung sumbu y
        console.log({ colorA1, colorA2 })

        const circleAlpha1 =
            svg.selectAll('circle.alpha1')
                .data(processedData)
                .enter()
                .append('circle')
                .attr('cx', d => x(d.tanggal))
                .attr('cy', d => y(d.adfa.alphaPlus))
                .attr('r', (d, i) => sizeCircleA1[i])
                .attr('fill', (d, i) => colorA1[i % colorA1.length])
                .on('mouseover', (event, d) => {
                    const [xPos, yPos] = d3.pointer(event);
                    let x = xPos + 10;

                    let labelsPurposion;

                    if (d.adfa.alphaPlus > 1.5) labelsPurposion = `<span class="me-2">Perlu di tindak lanjuti</span><span class="damger w-4 h-4 rounded-full bg-red-600 text-transparent">Aa</span>`;
                    if (d.adfa.alphaPlus > 1.2) labelsPurposion = `<span class="me-2">Pantau Terus</span><span class="warning w-4 h-4 rounded-full bg-orange-500 text-transparent">Aa</span>`;
                    if (d.adfa.alphaPlus <= 1.2) labelsPurposion = `<span class="me-2">Aman</span><span class="aman w-[16px] h-4 rounded-full bg-green-400 text-transparent">Aa</span>`;

                    if (scroolState[label] > 1) {
                        // x = xPos - (768 * (scroolState[label] - 1));
                    }
                    tooltip.style('left', `${x}px`)
                        .style('top', `${(yPos + 10)}px`)
                        .style('opacity', 1)
                        .html(`
                            ${labelsPurposion}
                            <p>Date: ${String(d.tanggal).split('GMT')[0]}</p> 
                            <p>Waktu awal : ${d.waktu_awal}</p>
                            <p> adfa AlphaPlus: ${d.adfa.alphaPlus}</p>
                            <p>Status Dfa: ${d["statusA1"]}</p>`);
                })
                .on('mouseout', () => {
                    tooltip.style('opacity', 0);
                });


        const circleAlpha2 =
            svg.selectAll('circle.alpha2')
                .data(processedData)
                .enter()
                .append('circle')
                .attr('cx', d => x(d.tanggal))
                .attr('cy', d => y(d.adfa.alphaMinus))
                .attr('r', (d, i) => sizeCircleA2[i])
                .attr('fill', (d, i) => colorA2[i % colorA2.length])
                .on('mouseover', (event, d) => {
                    // console.log('hover kok')
                    const [xPos, yPos] = d3.pointer(event);
                    let x = xPos + 10;

                    let labelsPurposion;

                    if (d.adfa.alphaMinus > 1.5) labelsPurposion = `<span class="me-2">Perlu di tindak lanjuti</span><span class="damger w-4 h-4 rounded-full bg-red-600 text-transparent">Aa</span>`;
                    if (d.adfa.alphaMinus > 1.2) labelsPurposion = `<span class="me-2">Pantau Terus</span><span class="warning w-4 h-4 rounded-full bg-orange-500 text-transparent">Aa</span>`;
                    if (d.adfa.alphaMinus <= 1.2) labelsPurposion = `<span class="me-2">Aman</span><span class="aman w-[16px] h-4 rounded-full bg-green-400 text-transparent">Aa</span>`;

                    if (scroolState[label] > 1) {
                        // x = xPos - (768 * (scroolState[label] - 1));
                    }
                    tooltip.style('left', `${x}px`)
                        .style('top', `${(yPos + 10)}px`)
                        .style('opacity', 1)
                        .html(`
                            ${labelsPurposion}
                            <p>Date: ${String(d.tanggal).split('GMT')[0]}</p> 
                            <p>Waktu awal : ${d.waktu_awal}</p>
                            <p> adfa AlphaMinus: ${d.adfa.alphaMinus}</p>
                            <p>Status Dfa: ${d["statusA2"]}</p>`);
                })
                .on('mouseout', () => {
                    tooltip.style('opacity', 0);
                });


        // const circleAlpha2 =
        //     svg.selectAll('circle.alpha2')
        //         .data(processedData)
        //         .enter()
        //         .append('circle')
        //         .attr('cx', d => x(d.tanggal))
        //         .attr('cy', d => y(d[keyValue].alpha2))
        //         .attr('r', (d, i) => sizeCircleA2[i])
        //         .attr('fill', (d, i) => colorA2[i % colorA2.length])
        //         .on('mouseover', (event, d) => {
        //             const [xPos, yPos] = d3.pointer(event);
        //             let x = xPos + 10;
        //             if (scroolState[label] > 1) {
        //                 // x = xPos - (768 * (scroolState[label] - 1));
        //             }
        //             tooltip.style('left', `${x}px`)
        //                 .style('top', `${(yPos + 10)}px`)
        //                 .style('opacity', 1)
        //                 .html(`<p>Date: ${String(d.tanggal).split('GMT')[0]}</p> 
        //                     <p>Waktu awal : ${d.waktu_awal}</p>
        //                     <p>Waktu akhir : ${d.waktu_akhir}</p>
        //                     <p>${keyValue}: ${d[keyValue].alpha2}</p>
        //                     <p>Status Dfa: ${d["statusA2"]}</p>`);
        //         })
        //         .on('mouseout', () => {
        //             tooltip.style('opacity', 0);
        //         });

        // Sumbu X dengan format jam menit detik saja
        const formatTime = d3.timeFormat("%H:%M:%S");
        svg.append('g')
            .attr('transform', `translate(${margin.left}, -5)`)
            .call(d3.axisLeft(y)
                .ticks(15));

        svg.append('g')
            .attr('transform', `translate(-15,${height - margin.bottom})`)
            .call(d3.axisBottom(x)
                .tickFormat(formatTime)
                .ticks(XCount)
                .tickPadding(8))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', 8);


    }


    // Fungsi untuk memproses data dan menghilangkan duplikat
    // const processData = (rawData) => {
    //     // Urutkan data berdasarkan tanggal
    //     const sortedData = rawData.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    //     // Gunakan Set untuk menyimpan nilai unik
    //     const uniqueValues = new Set();

    //     // Filter data untuk menghilangkan duplikat
    //     return sortedData.filter(item => {
    //         const value = item[keyValue];
    //         if (!uniqueValues.has(value)) {
    //             uniqueValues.add(value);
    //             return true;
    //         }
    //         return false;
    //     });
    // }

    // const y = d3.scaleTime()
    // .domain()

    return (
        <div className='relative p-4'>
            <div data-aos="fade-right" style={styleTooltype} id={`tooltip${label}-adfa`}></div>
            <div data-aos="fade-up" className="me-auto mb-3 flex items-center sm:justify-start justify-between">
                {slice > 1 ? (
                    <div>
                        {scroolState[label] > 1 ? (
                            <button type='button' className='rounded-md bg-slate-800 px-3 py-1 me-1' onClick={() => triggerSimulate('decrement')}>
                                <FaAngleLeft color='white' size={16} />

                            </button>
                        ) : null}
                        {scroolState[label] < slice ? (
                            <button type='button' className='rounded-md bg-slate-800 px-3 py-1 me-1' onClick={() => triggerSimulate('plus')}>
                                <FaAngleRight color='white' size={16} />
                            </button>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex sm:flex-row flex-col">
                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Slide {slider}
                    </button>
                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Graphic ADFA
                    </button>

                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        AlphaPlus
                        <span className='ms-2 w-4 h-4 bg-[#005A8F] rounded-full text-xs text-transparent'>lLL</span>
                    </button>
                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        AlphaMinus
                        <span className='ms-2 w-4 h-4 bg-[#07AC7B] dark:bg-[#217071] rounded-full text-xs text-transparent'>lLL</span>
                    </button>
                </div>
            </div>
            <div className="relative overflow-x-auto" data-aos="fade-right">
                <div ref={chartRef} className='svg-container flex max-w-screen relative ' id={`svg-container-${label}`}>

                </div>
                {/* <div className="rectangle w-full h-full z-[2] absolute top-0 left-0"></div> */}
            </div>

        </div>
    )

}

export default DfaGraphicADFA;