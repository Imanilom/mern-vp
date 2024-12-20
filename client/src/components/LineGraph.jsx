import { useRef, useState, useEffect } from 'react';

import * as d3 from 'd3'; // import d3 
import { FaAngleLeft } from "react-icons/fa"; // icon slide left
import { FaAngleRight } from "react-icons/fa"; // icon slide right
// import '../chart.css'; // include css untuk chart
import AOS from 'aos';

// daftarkan label 
// scroolState ini berfungsi untuk memantau pagination slide
// nama dari scroolState harus unique, jika ada di file lain bernama yang sama, bisa mempengaruhi grafik yang lain
let scroolState = {
    HR: 1, // slide untuk HR
    RR: 1, // slide untuk RR
    iHR: 0,
    iRR: 0
};

// Component
function LineGraph({ data, label, keyValue, color }) {
    // data : biasanya isinya array of object 
    // seperti : 
    // [{HR : .., RR : .., timestamp : ...}, {}, {}, ..]

    // label digunakan untuk menamai grafik

    // Keyvalue : biasanya isinya dari properti yang kita ingin jadikan sebuah grafik
    // example : kita akan menggambar grafik dari properti HR berrti keyValue = HR

    // color : menyimpan array of rgba, exampe [rgba('123', '123', '123', 0.4), ..., ..,]

    const chartRef = useRef(); // buat canvas
    const [slice, setSlice] = useState(1); // untuk tampilan di fe
    const [slider, setSlider] = useState(1); // gatau buat apa

    useEffect(() => {
        // Panggil AOS untuk animasi on scrool
        AOS.init({
            duration: 700
        })
    }, [])

    // Style ini berfungsi untuk tooltip, ketika titik point di hover
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


    // Fungsi drawchart dibawah dipaggil ketika : 
    // ketika pertama kali halaman dimuat
    // ketika ada filtering baru (date, metode algoturhma)
    useEffect(() => {
        drawChart(data);
    }, [data])

    // Handle untuk slider
    const triggerSimulate = (opt) => { // opt is string 
        if (opt == 'plus' && scroolState[label] < slice) { // jika opt == "plus" artinya next slider dan halaman nya masih bisa di slide next
            scroolState[label]++; // scroolState akan ditambahkan misal label = HR maka scroolState['HR'] + 1
            setSlider(slider + 1); // ubah juga untuk tampilan slide di fe
            drawChart(data) // gambar ulang chart

        } else if (opt == 'decrement' && scroolState[label] > 1) { // jika opt == "plus" artinya back slider dan halaman nya masih bisa di slide ke belakang
            setSlider(slider - 1); // ubah juga untuk tampilan slide di fe
            scroolState[label]--;
            drawChart(data) // gambar ulang chart
        }
    }

    // Sebelum data masuk untuk dijadikan grafik kita perlu buat property
    // untuk kita gunakan membuat label x dengan format tanggal / date

    data.forEach((d, i) => {

        // kasi properti baru yang nenampung date
        d.create_at = new Date(d.timestamp * 1000);
    });

    // Fitur bug, susah.
    const changeZoomText = (zoomV) => {
        document.getElementById(`zoom_panel_${label}`).innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
    }

    // Fungsi untuk memproses data dan menghilangkan duplikat data
    const processData = (rawData) => {

        // Urutkan data berdasarkan timestamp yang ada
        const sortedData = rawData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Gunakan Set untuk menyimpan nilai unik
        const uniqueValues = new Set();

        // Filter data untuk menghilangkan duplikat
        return sortedData.filter(item => {
            const value = item[keyValue];
            if (!uniqueValues.has(value)) {
                uniqueValues.add(value);
                return true;
            }
            return false;
        });
    }

    const drawChart = (rawData) => { // rawData adalah data mentahan

        let sizeCircle = []; // insisiasi variabel untuk menampung ukuran cicrle
        let processedData2 = processData(rawData); // process rawData supaya gada yang duplikat

        // Filtering untuk menghindari data yang null, karena data yang null bisa merusak grafik
        processedData2 = processedData2.filter(d => d.RR !== null && d.HR !== null);

        // Persiapan untuk pengelompokkan data berdasarkan tanggal
        const logsGroupDate = {};
        let date = "";
        let result = [];

        // Mengelompokkan data berdasarkan tanggal
        processedData2.forEach((val) => {
            date = val.datetime.split("T")[0];
            // const [y,m,d] = date.split("") 
            if (!logsGroupDate[date]) logsGroupDate[date] = [];
            logsGroupDate[date].push(val);
        });

        // Proses data per tanggal
        Object.entries(logsGroupDate).forEach(([date, logs]) => {

            let labelingMinute = ["00", "30"]; // hasilnya akan membuat titik awal seperti 00:00, 00:30, 01:00
            let labelingHour = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")); // ambil list jam dari 0 - 23

            let startDataTimeHour = logs[0].create_at.getHours(); // ambil jam awal dari hari ini
            let endDataTimeHour = logs[logs.length - 1].create_at.getHours(); // ambil jam terakhir dari hari ini

            // Menambahkan waktu awal
            for (let hour = 0; hour < startDataTimeHour; hour++) {
                labelingMinute.forEach((minute) => {
                    // buat titik kosongan
                    let datetime = new Date(`${date}T${labelingHour[hour]}:${minute}:00`);

                    // format disesuaikan saja dengan data asli
                    result.push({
                        HR: 0,
                        RR: 0,
                        create_at: datetime,
                        label: "safe",
                        timestamp: datetime.getTime(),
                    });
                });
            }

            // Setelah menambahkan data kosngan di awal, saatnya menambahkan data asli
            logs.forEach((log) => result.push(log));

            // Menambahkan data kosongan di akhir waktu agar data bisa sampai 23.30
            for (let hour = endDataTimeHour; hour < labelingHour.length; hour++) {
                labelingMinute.forEach((minute) => {

                    // buat titik kosongan
                    let datetime = new Date(`${date}T${labelingHour[hour]}:${minute}:00`);

                    // format disesuaikan saja dengan data asli
                    result.push({
                        HR: 0,
                        RR: 0,
                        create_at: datetime,
                        label: "safe",
                        timestamp: datetime.getTime(),
                    });
                });
            }
        });

        // Mengurutkan data berdasarkan waktu
        result.sort((a, b) => new Date(a.create_at) - new Date(b.create_at));

        // Menambahkan indeks ke data
        result.forEach((d, i) => (d.index = i));

        // max titik label x
        let maxTitik = 60;

        // Pengecekan responsive
        if (window.innerWidth > 980) {
            maxTitik = 60; // 40 - 60 udh best laptop / pc

        } else if (window.innerWidth > 540) {
            maxTitik = 45; // 45 udh best buat tablet

        } else {
            maxTitik = 20; // udah best buat hp
        }

        // Paginasi
        let page = scroolState[keyValue] - 1;

        // Fungsi untuk mendapatkan data sesuai dengan slide
        function getPaginatedData(data, page, maxTitik) {
            const startIndex = page * maxTitik;
            const endIndex = startIndex + maxTitik;
            return data.slice(startIndex, endIndex);
        }

        // Mendapatkan data yang diproses untuk halaman saat ini
        // const sampledData = result.filter((d, index) => index % 6 === 0);  // Mengambil setiap 6 data

        // Simpan data yang sudah dipaginasi
        const paginatedData = getPaginatedData(result, page, maxTitik);
        console.log({ paginatedData }, "INI PAGINATE");
        // let processedData = paginatedData;

        // Simpan ke processedData
        let processedData = paginatedData;

        // Jika saat ini berada di pagination terakhir
        // TUJUAN : Supaya kalo slide trakhir datanya dikit bisa pinjem sebagian data si slide sebelunya

        if (scroolState[keyValue] == Math.floor(result.length / maxTitik) + 1) {
            processedData = [];
            let indexStart = result.length - maxTitik;

            for (let i = 0; i < result.length; i++) {
                if (i >= indexStart) {
                    processedData.push(result[i]);
                }
            }
        }

        let defaultColor = "rgba(7, 172, 123, 1)"; // warna default untuk warna titik di tema gelap

        const theme = localStorage.getItem('_isLightMode'); // mengambil status theme

        if (theme == "true") { // is light state
            defaultColor = "rgba(33,113,122, 1)"; // ganti warnanya biar keliatan di light mode
        }

        // PERATURAN : 
        // Jika data saat ini dikurangi data sebelumnya (artinya terjadi penurunan) dan hasilnya di atas 10 (ini danger zone)
        // Jika data saat ini 50; data sebelumnya 70;
        // data sebelumnya (70) - data saat ini (50) = 20 // danger zone
        // Tujuan : mengumpulkan warna yang sesuai dengan kondisi untuk titik
        color = processedData.map((item, i) => {
            if (i > 0) {
                if (processedData[i - 1][keyValue] - processedData[i][keyValue] >= 10) {
                    return 'rgba(249, 39, 39, 0.8)'; // ini warna danger
                } else if (processedData[i - 1][keyValue] - processedData[i][keyValue] >= 5) {
                    return 'rgba(255, 161, 0, 1)'; // ini warna warning
                } else {
                    return defaultColor; // Warna default (aman)
                }
            }
            else {
                return defaultColor; // Warna default (aman)
            }
        });

        // PERATURANNYA SAMA KAYA DIATAS
        // Tujuan : mengumpulkan size yang sesuai dengan kondisi
        // size aman = 4; warning = 6; danger = 8;
        sizeCircle = processedData.map((item, i) => {
            if (i > 0) {
                if (processedData[i - 1][keyValue] - processedData[i][keyValue] >= 10) {
                    processedData[i]['label'] = "Danger"; // sisipkan juga label. akan kepakai di bawah
                    return 8; // ukuran 8 untuk damger
                }
                else if (processedData[i - 1][keyValue] - processedData[i][keyValue] >= 5) {
                    processedData[i]['label'] = "Warning"; // sisipkan juga label. akan kepakai di bawah
                    return 6;
                } else {
                    processedData[i]['label'] = "Safe"; // sisipkan juga label. akan kepakai di bawah
                    return 4;
                }
            } else {
                processedData[i]['label'] = "Safe"; // sisipkan juga label. akan kepakai di bawah
                return 4;
            }
        });

        // mengambil element tooltip
        const tooltip = d3.select(`#tooltip${label}`);
        const lastSvg = d3.select(chartRef.current); // variabel yang menampung element canvas

        lastSvg.selectAll('*').remove(); // hapus chart sebelumnya sebelum menggambar

        const height = 500; // height canvas (grafik)
        let width = 780; // width canvas (grafik)

        const margin = { top: 20, right: 30, bottom: 90, left: 30 };

        // Sesuaikan kembali width agar tampak responsive
        if (window.innerWidth > 980) {
            width = 780;
        } else if (window.innerWidth > 540) {
            width = window.innerWidth * 0.8;
        } else {
            width = window.innerWidth * 0.9;
        }

        // simpan informasi berapa banyak pagination yang bisa di slide
        setSlice(Math.floor(result.length / maxTitik) + 1);
        console.log(Math.floor(result.length / maxTitik) + 1, { scroolState })

        const svg = d3.select(chartRef.current) // gambar canvas 
            .append('svg')
            .attr('height', height)
            .attr('width', width)
            .attr('class', 'svgOne bg-[#101010] dark:bg-[#FEFCF5] min-w-lg') // kasi class untuk bg

        // Atur skala waktu X
        const x = d3.scaleBand()
            .domain(processedData.map(d => d.create_at)) // create_at typenya harus date
            // .range([margin.left, width - margin.right]);
            .range([margin.left, width - margin.right]);


        // Dapatkan nilai maksimum dan minimum data
        const maxValue = d3.max(processedData, d => d[keyValue]);
        let minValue = d3.min(processedData, (d) => {
            if (d[keyValue] != 0) {
                return d[keyValue]
            }
        });

        // Jika minValue == undefined karena data saat ini 0 semua
        if (!minValue) minValue = 0;

        console.log({ minValue, maxValue })

        // Atur posisi y
        const y = d3.scaleLinear()
            .domain([minValue, maxValue]) // Menambah ruang di atas dan bawah
            .range([height - margin.bottom, margin.top]);

        // arah garis
        const line = d3.line()
            .x(d => x(d.create_at))
            .y(d => d[keyValue] == 0 ? y(minValue) : y(d[keyValue])); // Titik kosong set aja ke minValue. agar menghindari angka 0

        // bikin garis dan masukkan titik data 
        svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', defaultColor)
            .attr('stroke-width', 2)
            .attr('d', line); // daftarkan garis

        // Deteksi perubahan tanggal
        let previousDate = null;

        // Fungsi untuk membuat garis - garis yang menandakan perbedaan hari
        processedData.forEach((d, i) => {
            const currentDate = d.create_at.toDateString();
            if (previousDate !== currentDate) {
                // Gambar garis putus-putus di sini
                svg.append('line')
                    .attr('x1', x(d.create_at)) // Posisi X berdasarkan tanggal
                    .attr('y1', margin.top)
                    .attr('x2', x(d.create_at)) // Posisi X untuk garis vertikal
                    .attr('y2', height - margin.bottom)
                    .attr('stroke', theme == "true" ? "gray" : "white")
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '5,5'); // Mengatur garis menjadi putus-putus

                // Tambahkan label tanggal di dekat garis putus-putus
                svg.append('text')
                    .attr('x', x(d.create_at) + 5)
                    .attr('y', margin.top - 5)
                    .attr('fill', theme == "true" ? "gray" : "white")
                    .attr('font-size', 10)
                    .text(currentDate);
            }
            previousDate = currentDate;
        });

        // Memberikan lingkaran pada setiap titik
        svg.selectAll('circle')
            .data(processedData) // masukan data yang sudah di proses
            .enter()
            .append('circle') // tambahkan lingkaran
            .attr('cx', d => x(d.create_at)) // tematkan tepat sama di label x
            .attr('cy', d => d[keyValue] == 0 ? y(minValue) : y(d[keyValue])) // tempatkan tepat dengan label y
            .attr('r', (d, i) => sizeCircle[i]) // ukuran lingkaran
            .attr('fill', (d, i) => color[i % color.length]) // warna lingkaran

            // Tambahkan event on mouse over
            .on('mouseover', function (event, d, i) { // Menggunakan function untuk akses parameter dengan benar
              
                let labelsPurposion;

                // untuk membuat kondisional warna dipopup 
                if (d.label == "Safe") labelsPurposion = `<span class="me-2">Aman</span><span class="aman w-[16px] h-4 rounded-full bg-green-400 text-transparent">Aa</span>`;
                if (d.label == "Warning") labelsPurposion = `<span class="me-2">Pantau Terus</span><span class="warning w-4 h-4 rounded-full bg-orange-500 text-transparent">Aa</span>`;
                if (d.label == "Danger") labelsPurposion = `<span class="me-2">Perlu di tindak lanjuti</span><span class="damger w-4 h-4 rounded-full bg-red-600 text-transparent">Aa</span>`;

                const [xPos, yPos] = d3.pointer(event);
                let x = xPos + 10; // letak titik horizontal
                x = xPos;

                // Kurangi nilai x apabila letak titiknya lebih dr 600
                if (x > 600) {
                    x = x - 250;
                }

                tooltip.style('left', `${x}px`) // kasi style dl buat nentuin posisi munculnya popup
                    .style('top', `${(yPos + 10)}px`) // kasi style dl buat nentuin posisi munculnya popup
                    .style('opacity', 1) // set opacitry ke 1 biar keliatan
                    // Tambahkan konten pada popup
                    .html(`
                                ${labelsPurposion}
                                <p>Date: ${String(d.create_at).split('GMT')[0]}</p> 
                                <p>Aktivitas Pasien: ${d.activity === undefined ? 'Tidak ada riwayat' : d.activity}</p>
                                <p>${keyValue}: ${d[keyValue]}</p>`);
            })

            // Tambahkan event on mouse out
            .on('mouseout', () => {
                tooltip.style('opacity', 0); // set ke 0 supaya invisible
            });

        // Sumbu X dengan format jam menit detik saja
        const formatTime = d3.timeFormat("%H:%M:%S"); // set format label x

        // gambar garis label X
        svg.append('g')
            .attr('transform', `translate(0, ${height - margin.bottom})`)
            .call(d3.axisBottom(x) // axisBottom = buat garis di bawah
                .tickFormat(formatTime) // gunakan formatime disini
                .ticks(20)
                .tickPadding(8)) // jarak antara label x dan garis
            .selectAll('text') // Memilih semua teks label pada sumbu X
            .style('text-anchor', 'end') // Menyetel posisi anchor teks ke ujung
            .attr('dx', '-0.8em') // Mengatur jarak horizontal
            .attr('dy', '0.15em') // Mengatur jarak vertikal
            .attr('transform', 'rotate(-45)'); // merotasi teks label sebesar -45 derajat

        const yAxis = d3.axisLeft(y);

        // gambar garis label Y
        svg.append('g')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(yAxis); // gunakan yAxis disini
    }

    return (
        <div className='relative md:p-4'>
            {/* ini tooltip / popup */}
            <div data-aos="fade-right" style={styleTooltype} id={`tooltip${label}`}></div>
            {/* ini tooltip / popup END */}

            <div data-aos="fade-up" className="me-auto mb-3 flex items-center sm:justify-start justify-between">
                {slice > 1 ? (
                    <div>
                        {/* Ini controller slider */}
                        {scroolState[keyValue] > 1 ? (
                            <button className='rounded-md bg-slate-800 dark:bg-[#FFD166] px-3 py-1 me-1' onClick={() => triggerSimulate('decrement')}>
                                <FaAngleLeft color='white' size={16} />
                            </button>
                        ) : null}
                        {scroolState[keyValue] < slice ? (
                            <button className='rounded-md bg-slate-800 dark:bg-[#FFD166] px-3 py-1 me-1' onClick={() => triggerSimulate('plus')}>
                                <FaAngleRight color='white' size={16} />
                            </button>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex sm:flex-row flex-col">
                    {/* Ini infromasi label */}
                    <button id={`zoom_panel_${label}`} className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Slide {slider}
                    </button>
                    <button id='' className='rounded-md bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Graphic {label}
                        <span className='ms-2 w-4 h-4 bg-[#07AC7B] dark:bg-[#217170] rounded-full text-xs text-transparent'>lLL</span>
                    </button>
                </div>
            </div>

            {/* Ini grafik */}
            <div className="relative" data-aos="fade-right">
                {/* chartRef akan ditimpa dengan grafik */}
                <div ref={chartRef} className='svg-container relative ' id={`svg-container-${label}`}>

                </div>
            </div>

        </div>
    )
}

export default LineGraph;