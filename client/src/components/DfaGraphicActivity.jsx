import { useRef, useState, useEffect } from 'react';

import * as d3 from 'd3';
import { FaAngleLeft } from "react-icons/fa";
import { FaAngleRight } from "react-icons/fa";
import '../chart.css';
import AOS from 'aos';


let scroolState = {
    HR: 1, // daftarkan label 
    RR: 1,
    DFA: 1,
    DfaActivity: 1
};

function DfaGraphicActivity({ data, label, keyValue, color }) {

    const [scroolLevel, setScroolLevel] = useState(1);
    const chartRef = useRef();
    const [slice, setSlice] = useState(1);
    const [slider, setSlider] = useState(1);
    const XCount = 5;
    const [showKey, setShowKey] = useState("DUO");
    const [changeLeft, setChangeLeft] = useState("alpha1");

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
        // drawChart();
    }, [])

    useEffect(() => {
        drawChart(data, changeLeft);
    }, [changeLeft]);

    useEffect(() => {
        drawChart(data);
    }, [showKey]);

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

    const changeSelect = (e) => {
        scroolState["DfaActivity"] = e.target.value;
        setSlider(e.target.value)
        drawChart(data);
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

    // useEffect(() => {
    //   // init for using label x date
    //   const parseDate = d3.timeParse('%d-%m-%Y %H:%M:%S'); // function untuk merubah string to date
    console.log({ data })
    data.forEach((d, i) => {
        // Format tanggal asli tanpa waktu
        // const dateStr = new Date(formatedDate(d.tanggal)).toISOString().split('T')[0]; // Ambil bagian tanggal saja (yyyy-mm-dd)
        // const dateStr = new Date(d.details[0]['timestamp'] * 1000);
        const [day, m, y] = d.metrics.timestamps.start.replace(" ", "T").split("T")[0].split('-');
        const [hour, minute, sec] = d.metrics.timestamps.start.replace(" ", "T").split("T")[1].split(':');
        const dateStr = new Date(`${y}-${m}-${day}T${hour}:${minute}:${sec}`);
        console.log(d.metrics.timestamps.start.replace(" ", "T"));
        // Gabungkan dengan waktu_awal
        const combinedDateTime = `${dateStr}T${d.waktu_awal}`; // Format ISO: yyyy-mm-ddTHH:MM:SS
        // console.log({ combinedDateTime, dateStr }, d);
        // console.log(typeof d.tanggal != 'object')
        // Buat objek Date baru berdasarkan gabungan
        // if (typeof d.tanggal != 'object') {
        //     d.tanggal = dateStr // Update tanggal agar mengikuti waktu_awal
        // }

        d.tanggal_waktu = combinedDateTime;
        d.tanggal_timestamp = dateStr;


        // console.log(d.tanggal);
    });

    // console.log({ data })

    const changeZoomText = (zoomV) => {
        document.getElementById(`zoom_panel_${label}`).innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
    }

    const drawChart = (rawData, leftLabeling = "alpha1") => {
        console.log({ rawData }, 'woy')
        // let processedData = rawData.filter(d => d.dfa !== null);
        // let processedData = rawData;
        let processedData2 = rawData.filter(d => d.metrics.metrics.dfa.alpha1 !== null && d.metrics.metrics.alpha2 !== null);;

        const logsGroupDate = {};
        let date = "";
        let result = [];

        processedData2.forEach((val) => {
            date = val.tanggal;
            // const [y,m,d] = date.split("") 
            if (!logsGroupDate[date]) logsGroupDate[date] = [];
            logsGroupDate[date].push(val);
        });

        console.log({ logsGroupDate });

        // Proses data per tanggal
        Object.entries(logsGroupDate).forEach(([date, metricsAktivitas]) => {
            let labelingMinute = ["00", "30"];
            let labelingHour = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));

            let startDataTimeHour = metricsAktivitas[0].tanggal_timestamp.getHours();
            let endDataTimeHour = metricsAktivitas[metricsAktivitas.length - 1].tanggal_timestamp.getHours();

            console.log({ metricsAktivitas, startDataTimeHour, endDataTimeHour });

            // Menambahkan waktu awal
            for (let hour = 0; hour < startDataTimeHour; hour++) {
                labelingMinute.forEach((minute) => {
                    const [d, m, y] = date.split('-');
                    let datetime = new Date(`${y}-${m}-${d}T${labelingHour[hour]}:${minute}:00`);
                    // console.log({datetime, date})
                    result.push({
                        aktivitas: "Uknown",
                        metrics: {
                            metrics: {
                                adfa: {
                                    alpha1: 0,
                                    alpha2: 0
                                },
                                dfa: {
                                    alphaPlus: 0,
                                    alphaMinus: 0
                                }
                            }
                        },
                        tanggal: date,
                        tanggal_timestamp: datetime,
                        tanggal_waktu: datetime.toISOString(),
                        timestamp: datetime.getTime(),
                    });
                });
            }

            // Menambahkan data asli
            metricsAktivitas.forEach((metric) => result.push(metric));
            console.log({ date, metricsAktivitas })

            // Menambahkan waktu akhir
            for (let hour = endDataTimeHour; hour < labelingHour.length; hour++) {
                labelingMinute.forEach((minute) => {
                    const [d, m, y] = date.split('-');
                    let datetime = new Date(`${y}-${m}-${d}T${labelingHour[hour]}:${minute}:00`);
                    // console.log({datetime, date})
                    result.push({
                        aktivitas: "Uknown",
                        metrics: {
                            metrics: {
                                adfa: {
                                    alpha1: 0,
                                    alpha2: 0
                                },
                                dfa: {
                                    alphaPlus: 0,
                                    alphaMinus: 0
                                }
                            }
                        },
                        tanggal: date,
                        tanggal_timestamp: datetime,
                        tanggal_waktu: String(datetime),
                        timestamp: datetime.getTime(),
                    });
                });
            }
        });


        // Mengurutkan data berdasarkan waktu
        result.sort((a, b) => new Date(a.create_at) - new Date(b.create_at));
        console.log({ result });


        // Menambahkan indeks ke data
        result.forEach((d, i) => (d.index = i));

        let maxTitik = 20;

        if (window.innerWidth > 980) {
            maxTitik = 20;
        } else if (window.innerWidth > 540) {
            maxTitik = 20;
        } else {
            maxTitik = 10
        }

        let page = scroolState[label] - 1;

        // Fungsi untuk mendapatkan data sesuai dengan halaman
        function getPaginatedData(data, page, maxTitik) {
            const startIndex = page * maxTitik;
            const endIndex = startIndex + maxTitik;
            return data.slice(startIndex, endIndex);
        }

        // Mendapatkan data yang diproses untuk halaman saat ini
        const paginatedData = getPaginatedData(result, page, maxTitik);

        let processedData = paginatedData;

        // Jika saat ini berada di pagination terakhir
        // TUJUAN : Supaya kalo slide trakhir datanya dikit bisa pinjem sebagian data si slide sebelunya

        if (scroolState[label] == Math.floor(result.length / maxTitik) + 1) {
            processedData = [];
            let indexStart = result.length - maxTitik;

            for (let i = 0; i < result.length; i++) {
                if (i >= indexStart) {
                    processedData.push(result[i]);
                }
            }
        }

        processedData.sort((a, b) => a.tanggal_timestamp - b.tanggal_timestamp)

        const HitungDFA = () => {
            let arrayOfDataDfa = [];
            processedData.map((d, i) => {

                if (!d.metrics.metrics.dfa.alpha1 || isNaN(d.metrics.metrics.dfa.alpha1)) {
                    d.dfa = {
                        alpha1: 0,
                        alpha2: 0
                    };
                }
                else {
                    d.dfa = d.metrics.metrics.dfa;
                }

                console.log({ i, }, d.dfa)

                let statusA1 = 'Safe';
                if (d.dfa.alpha1 > 1.2) statusA1 = 'Warning'
                if (d.dfa.alpha1 > 1.5) statusA1 = 'Danger'

                let statusA2 = 'Safe';
                if (d.dfa.alpha2 > 1.2) statusA2 = 'Warning'
                if (d.dfa.alpha2 > 1.5) statusA2 = 'Danger'

                // Debugging, lihat hasilnya

                d.statusA1 = statusA1;
                d.statusA2 = statusA2;

                arrayOfDataDfa.push(d);
            })

            processedData = arrayOfDataDfa;
        }

        HitungDFA(); // run fucntion

        console.log({ processedData, page, maxTitik })

        let colorA1 = processedData.map(item => {
            if (item.statusA1 === 'Safe') return 'rgba(69, 252, 124, 0.9)'; // Merah untuk berjalan 
            if (item.statusA1 === 'Warning') return 'rgba(246, 118, 37, 0.9)'; // Hijau untuk tidur
            if (item.statusA1 === 'Danger') return 'rgba(255, 0, 0, 0.9)'; // Ungu untuk Berolahraga
            // return 'rgba(75, 192, 192, 1)'; // Warna default
            return 'rgba(7, 172, 123, 1)'; // Warna default
        });

        let colorA2 = processedData.map(item => {
            if (item.statusA2 === 'Safe') return 'rgba(69, 252, 124, 0.9)'; // Merah untuk berjalan 
            if (item.statusA2 === 'Warning') return 'rgba(246, 118, 37, 0.9)'; // Hijau untuk tidur
            if (item.statusA2 === 'Danger') return 'rgba(255, 0, 0, 0.9)'; // Ungu untuk Berolahraga
            // return 'rgba(75, 192, 192, 1)'; // Warna default
            return 'rgba(7, 172, 123, 1)'; // Warna default
        });


        let sizeCircleA1 = processedData.map((item, i) => {
            if (item.statusA1 === 'Safe') return 4; // Merah untuk berjalan 
            if (item.statusA1 === 'Warning') return 6; // Hijau untuk tidur
            if (item.statusA1 === 'Danger') return 8; // Ungu untuk Berolahraga
            // return 'rgba(75, 192, 192, 1)'; // Warna default
            return 4; // Warna default
        })
        let sizeCircleA2 = processedData.map((item, i) => {
            if (item.statusA2 === 'Safe') return 4; // Merah untuk berjalan 
            if (item.statusA2 === 'Warning') return 6; // Hijau untuk tidur
            if (item.statusA2 === 'Danger') return 8; // Ungu untuk Berolahraga
            // return 'rgba(75, 192, 192, 1)'; // Warna default
            return 4; // Warna default
        })


        // mengambil element tooltip
        const tooltip = d3.select(`#tooltip${label}`);
        const lastSvg = d3.select(chartRef.current);
        lastSvg.selectAll('*').remove()

        const height = 500;
        let width = 780;

        const margin = { top: 20, right: 20, bottom: 90, left: 50 };

        // Sesuaikan kembali width agar tampak responsive
        if (window.innerWidth > 980) {
            width = 780;
        } else if (window.innerWidth > 540) {
            width = window.innerWidth * 0.8;
        } else {
            width = window.innerWidth * 0.9;
        }

        setSlice(Math.floor(result.length / maxTitik) + 1);

        let defaultColor = "rgba(7, 172, 123, 1)";

        const theme = localStorage.getItem('_isLightMode');
        if (theme == "true") { // is light state
            defaultColor = "rgba(33,113,122, 1)";
        }

        const svg = d3.select(chartRef.current)
            .append('svg')
            .attr('height', height)
            .attr('width', width)
            .attr('class', 'svgOne bg-[#101010] dark:bg-[#FEFCF5] min-w-lg')

        // const x = d3.scaleBand()
        //     .domain(processedData.map(d => d.tanggal))
        //     .range([margin.left, width - margin.right]);

        const x = d3.scaleBand()
            .domain(processedData.map(d => d.tanggal_timestamp))
            .range([margin.left, width - margin.right])
            .padding(0.05);  // Kurangi padding agar lebih banyak label ditampilkan


        // Dapatkan nilai maksimum dan minimum data
        const maxValueA1 = d3.max(processedData, d => d.dfa.alpha1);
        let minValueA1 = d3.min(processedData, (d) => {
            if (d.dfa.alpha1 != 0) {
                return d.dfa.alpha1
            }
        });

        const maxValueA2 = d3.max(processedData, d => d.dfa.alpha2);
        let minValueA2 = d3.min(processedData, (d) => {
            if (d.dfa.alpha2 != 0) {
                return d.dfa.alpha2
            }
        });

        if (!minValueA1) minValueA1 = 0;
        if (!minValueA2) minValueA2 = 0;

        const yA1 = d3.scaleLinear()
            // .domain([0, d3.max(processedData, d => Math.max(d.dfa.alpha1, d.dfa.alpha2)) + 0.2])
            .domain([minValueA1, maxValueA1])
            .range([height - margin.bottom, margin.top]);

        const yA2 = d3.scaleLinear()
            // .domain([0, d3.max(processedData, d => Math.max(d.dfa.alpha1, d.dfa.alpha2)) + 0.2])
            .domain([minValueA2, maxValueA2])
            .range([height - margin.bottom, margin.top]);

        const lineA1 = d3.line()
            .x(d => x(d.tanggal_timestamp))
            // .y(d => y(d["dfa"].alpha1 ?? 0));
            .y(d => {
                return d.dfa.alpha1 == 0 ? yA1(minValueA1) : yA1(d.dfa.alpha1)
            });


        const lineA2 = d3.line()
            .x(d => x(d.tanggal_timestamp))
            // .y(d => y(d["dfa"].alpha2 ?? 0));
            .y(d => {
                return d.dfa.alpha2 == 0 ? yA2(minValueA2) : yA2(d.dfa.alpha2)
            });

        processedData.forEach(d => {
            if (!d.tanggal_timestamp || isNaN(d["dfa"]?.alpha1) || isNaN(d["dfa"]?.alpha2)) {
                console.error('Invalid data:', d);
            }
        });

        if (showKey == "DUO") {

            let linePathA1 = svg.append('path')
                .datum(processedData)
                .attr('fill', 'none')
                .attr('stroke', "#217170")
                .attr('stroke-width', 2)
                .attr('d', lineA1);

            let linePathA2 = svg.append('path')
                .datum(processedData)
                .attr('fill', 'none')
                .attr('stroke', "#FFD166")
                .attr('stroke-width', 2)
                .attr('d', lineA2);

        } else if (showKey == "alpha1") {

            let linePathA1 = svg.append('path')
                .datum(processedData)
                .attr('fill', 'none')
                .attr('stroke', "#217170")
                .attr('stroke-width', 2)
                .attr('d', lineA1);
        } else {

            let linePathA2 = svg.append('path')
                .datum(processedData)
                .attr('fill', 'none')
                .attr('stroke', "#FFD166")
                .attr('stroke-width', 2)
                .attr('d', lineA2);
        }

        // Deteksi perubahan tanggal
        let previousDate = null;

        processedData.forEach((d, i) => {
            // console.log({ d }, 'DfaGraphic');
            const currentDate = d.tanggal_timestamp.toDateString();
            if (previousDate !== currentDate) {
                // Gambar garis putus-putus di sini
                svg.append('line')
                    .attr('x1', x(d.tanggal_timestamp)) // Posisi X berdasarkan tanggal
                    .attr('y1', margin.top)
                    .attr('x2', x(d.tanggal_timestamp)) // Posisi X untuk garis vertikal
                    .attr('y2', height - margin.bottom)
                    .attr('stroke', theme == "true" ? "gray" : "white")
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '5,5'); // Mengatur garis menjadi putus-putus

                // Tambahkan label tanggal di dekat garis putus-putus
                svg.append('text')
                    .attr('x', x(d.tanggal_timestamp) + 5)
                    .attr('y', margin.top - 5)
                    .attr('fill', theme == "true" ? "gray" : "white")
                    .attr('font-size', 10)
                    .text(currentDate);
            }
            previousDate = currentDate;
        });

        // Memberikan titik pada ujung sumbu y
        console.log({ colorA1, colorA2 })

        if (showKey == "DUO") {

            const circleAlpha1 =
                svg.selectAll('circle.alpha1')
                    .data(processedData)
                    .enter()
                    .append('circle')
                    .attr('cx', d => x(d.tanggal_timestamp))
                    // .attr('cy', d => y(d["dfa"].alpha1 ?? 0))
                    .attr('cy', d => {
                        return d.dfa.alpha1 == 0 ? yA1(minValueA1) : yA1(d.dfa.alpha1)
                    })
                    .attr('r', (d, i) => sizeCircleA1[i])
                    .attr('fill', "#217170")
                    .on('mouseover', (event, d) => {

                        let labelsPurposion;

                        if (d.statusA1 == "Safe") labelsPurposion = `<span class="me-2">Aman</span><span class="aman w-[16px] h-4 rounded-full bg-green-400 text-transparent">Aa</span>`;
                        if (d.statusA1 == "Warning") labelsPurposion = `<span class="me-2">Pantau Terus</span><span class="warning w-4 h-4 rounded-full bg-orange-500 text-transparent">Aa</span>`;
                        if (d.statusA1 == "Danger") labelsPurposion = `<span class="me-2">Perlu di tindak lanjuti</span><span class="damger w-4 h-4 rounded-full bg-red-600 text-transparent">Aa</span>`;

                        const [xPos, yPos] = d3.pointer(event);
                        let x = xPos + 10;

                        if (x > 600) {
                            x = x - 250;
                        }

                        tooltip.style('left', `${x}px`)
                            .style('top', `${(yPos + 10)}px`)
                            .style('opacity', 1)
                            .html(`
                                <p>${labelsPurposion}</p>
                                <p>Date: ${String(d.tanggal).split('GMT')[0]}</p> 
                              <p> Alpha_1: ${d["dfa"].alpha1}</p>
                                <p> Aktivitas : ${d.Aktivitas}</p>
                                <p>Status Dfa Alpha1: ${d["statusA1"]}</p>`);
                    })
                    .on('mouseout', () => {
                        tooltip.style('opacity', 0);
                    });


            const circleAlpha2 =
                svg.selectAll('circle.alpha2')
                    .data(processedData)
                    .enter()
                    .append('circle')
                    .attr('cx', d => x(d.tanggal_timestamp))
                    // .attr('cy', d => y(d["dfa"].alpha2 ?? 0))
                    .attr('cy', d => {
                        return d.dfa.alpha2 == 0 ? yA2(minValueA2) : yA2(d.dfa.alpha2)
                    })
                    .attr('r', (d, i) => sizeCircleA2[i])
                    .attr('fill', '#FFD166')
                    .on('mouseover', (event, d) => {

                        let labelsPurposion;

                        if (d.statusA2 == "Safe") labelsPurposion = `<span class="me-2">Aman</span><span class="aman w-[16px] h-4 rounded-full bg-green-400 text-transparent">Aa</span>`;
                        if (d.statusA2 == "Warning") labelsPurposion = `<span class="me-2">Pantau Terus</span><span class="warning w-4 h-4 rounded-full bg-orange-500 text-transparent">Aa</span>`;
                        if (d.statusA2 == "Danger") labelsPurposion = `<span class="me-2">Perlu di tindak lanjuti</span><span class="damger w-4 h-4 rounded-full bg-red-600 text-transparent">Aa</span>`;

                        const [xPos, yPos] = d3.pointer(event);
                        let x = xPos + 10;

                        if (x > 600) {
                            x = x - 250;
                        }
                        tooltip.style('left', `${x}px`)
                            .style('top', `${(yPos + 10)}px`)
                            .style('opacity', 1)
                            .html(`
                                          <p>${labelsPurposion}</p>
                                        <p>Date: ${String(d.tanggal_waktu).split('GMT')[0]}</p> 
                                        <p> Alpha_2: ${d["dfa"].alpha2}</p>
                                        <p> Aktivitas : ${d.aktivitas}</p>
                                        <p> Status Dfa Alpha2: ${d["statusA2"]}</p>`);
                    })
                    .on('mouseout', () => {
                        tooltip.style('opacity', 0);
                    });
        } else {
            if (showKey == "alpha1") {
                const circleAlpha1 =
                    svg.selectAll('circle.alpha1')
                        .data(processedData)
                        .enter()
                        .append('circle')
                        .attr('cx', d => x(d.tanggal_timestamp))
                        // .attr('cy', d => y(d["dfa"].alpha1 ?? 0))
                        .attr('cy', d => {
                            return d.dfa.alpha1 == 0 ? yA1(minValueA1) : yA1(d.dfa.alpha1)
                        })
                        .attr('r', (d, i) => sizeCircleA1[i])
                        .attr('fill', "#217170")
                        .on('mouseover', (event, d) => {

                            let labelsPurposion;

                            if (d.statusA1 == "Safe") labelsPurposion = `<span class="me-2">Aman</span><span class="aman w-[16px] h-4 rounded-full bg-green-400 text-transparent">Aa</span>`;
                            if (d.statusA1 == "Warning") labelsPurposion = `<span class="me-2">Pantau Terus</span><span class="warning w-4 h-4 rounded-full bg-orange-500 text-transparent">Aa</span>`;
                            if (d.statusA1 == "Danger") labelsPurposion = `<span class="me-2">Perlu di tindak lanjuti</span><span class="damger w-4 h-4 rounded-full bg-red-600 text-transparent">Aa</span>`;

                            const [xPos, yPos] = d3.pointer(event);
                            let x = xPos + 10;

                            if (x > 600) {
                                x = x - 250;
                            }

                            tooltip.style('left', `${x}px`)
                                .style('top', `${(yPos + 10)}px`)
                                .style('opacity', 1)
                                .html(`
                                <p>${labelsPurposion}</p>
                                <p>Date: ${String(d.tanggal).split('GMT')[0]}</p> 
                              <p> Alpha_1: ${d["dfa"].alpha1}</p>
                                <p> Aktivitas : ${d.Aktivitas}</p>
                                <p>Status Dfa Alpha1: ${d["statusA1"]}</p>`);
                        })
                        .on('mouseout', () => {
                            tooltip.style('opacity', 0);
                        });
            } else {
                const circleAlpha2 =
                    svg.selectAll('circle.alpha2')
                        .data(processedData)
                        .enter()
                        .append('circle')
                        .attr('cx', d => x(d.tanggal_timestamp))
                        // .attr('cy', d => y(d["dfa"].alpha2 ?? 0))
                        .attr('cy', d => {
                            return d.dfa.alpha2 == 0 ? yA2(minValueA2) : yA2(d.dfa.alpha2)
                        })
                        .attr('r', (d, i) => sizeCircleA2[i])
                        .attr('fill', '#FFD166')
                        .on('mouseover', (event, d) => {

                            let labelsPurposion;

                            if (d.statusA2 == "Safe") labelsPurposion = `<span class="me-2">Aman</span><span class="aman w-[16px] h-4 rounded-full bg-green-400 text-transparent">Aa</span>`;
                            if (d.statusA2 == "Warning") labelsPurposion = `<span class="me-2">Pantau Terus</span><span class="warning w-4 h-4 rounded-full bg-orange-500 text-transparent">Aa</span>`;
                            if (d.statusA2 == "Danger") labelsPurposion = `<span class="me-2">Perlu di tindak lanjuti</span><span class="damger w-4 h-4 rounded-full bg-red-600 text-transparent">Aa</span>`;

                            const [xPos, yPos] = d3.pointer(event);
                            let x = xPos + 10;

                            if (x > 600) {
                                x = x - 250;
                            }
                            tooltip.style('left', `${x}px`)
                                .style('top', `${(yPos + 10)}px`)
                                .style('opacity', 1)
                                .html(`
                                          <p>${labelsPurposion}</p>
                                        <p>Date: ${String(d.tanggal_waktu).split('GMT')[0]}</p> 
                                        <p> Alpha_2: ${d["dfa"].alpha2}</p>
                                        <p> Aktivitas : ${d.aktivitas}</p>
                                        <p> Status Dfa Alpha2: ${d["statusA2"]}</p>`);
                        })
                        .on('mouseout', () => {
                            tooltip.style('opacity', 0);
                        });
            }
        }



        // Sumbu X dengan format jam menit detik saja
        const formatTime = d3.timeFormat("%H:%M:%S");

        // Gunakan sumbu Y

        if (showKey == "DUO") {
            let appendGY = svg.append('g')
                .attr('transform', `translate(${margin.left}, -5)`);
            // .call(d3.axisLeft(y)
            //     .ticks(15));

            if (leftLabeling == "alpha1") {
                appendGY
                    .call(d3.axisLeft(yA1)
                        .ticks(15))
            }

            if (leftLabeling == "alpha2") {
                appendGY
                    .call(d3.axisLeft(yA2)
                        .ticks(15))
            }
        }
        else {
            if (showKey == "alpha1") {
                svg.append('g')
                    .attr('transform', `translate(${margin.left}, -5)`)
                    .call(d3.axisLeft(yA1)
                        .ticks(15));
            }

            if (showKey == "alpha2") {
                svg.append('g')
                    .attr('transform', `translate(${margin.left}, -5)`)
                    .call(d3.axisLeft(yA2)
                        .ticks(15));
            }
        }

        svg.append('g')
            .attr('transform', `translate(-30,${height - margin.bottom})`)
            .call(d3.axisBottom(x)
                .tickFormat(formatTime)
                .ticks(XCount)
                .tickPadding(8))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', 8);


    }

    return (
        <div className='relative p-4'>
            <div data-aos="fade-right" style={styleTooltype} id={`tooltip${label}`}></div>
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

                        {/* <select onChange={changeSelect} name="" className="mx-2 shadow-2xl bg-slate-800 px-3 py-2 rounded-md dark:bg-[#101010]/10 text-white dark:text-[#101010]/70" id="">
                            {Array.from({ length: slice - 1 }).map((_d, _i) => {
                                return (
                                    <option value={_i + 1}>Slide ke- {_i + 1}</option>
                                )
                            })}
                        </select> */}
                    </div>
                ) : null}

                <div className="flex sm:flex-row flex-col">
                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Slide {slider}
                    </button>
                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Graphic {label}
                    </button>

                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Alpha_1
                        <span className='ms-2 w-4 h-4 bg-[#217170] rounded-full text-xs text-transparent'>wii</span>
                    </button>
                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Alpha_2
                        <span className='ms-2 w-4 h-4 bg-[#FFD166] rounded-full text-xs text-transparent'>wii</span>
                    </button>
                    {/* <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Danger
                        <span className='ms-2 w-4 h-4 bg-[#ff0000e6] rounded-full text-xs text-transparent'>wii</span>
                    </button> */}

                    <select className="rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-xs" name="" id="" onChange={(e) => setShowKey(e.target.value)}>
                        <option value="DUO">Show All</option>
                        <option value="alpha1">Show Alpha1 Only</option>
                        <option value="alpha2">Show Alpha2 Only</option>
                    </select>
                    <select className="rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-xs" name="" id="" onChange={(e) => setChangeLeft(e.target.value)}>
                        <option value="alpha1">Left Point Alpha1 </option>
                        <option value="alpha2">Left Point Alpha2 </option>
                    </select>
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

export default DfaGraphicActivity;