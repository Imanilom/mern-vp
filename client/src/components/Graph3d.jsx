import { useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import { FaAngleLeft, FaAngleRight } from "react-icons/fa";
import '../chart.css';
import AOS from 'aos';

let scroolState = {
    HR: 1,
    RR: 1,
    Data3dp: 1,
    iData3dp: 1
};

function Graph3d({ data, label, color }) {
    const [scroolLevel, setScroolLevel] = useState(1);
    const chartRef = useRef();
    const [slice, setSlice] = useState(1);
    const [slider, setSlider] = useState(1);
    let XCount = 10;

    useEffect(() => {
        AOS.init({ duration: 700 });
    }, []);

    let styleTooltype = {
        position: 'absolute',
        pointerEvents: 'none',
        background: 'rgba(0, 0, 0, 0.7)',
        color: '#fff',
        padding: '5px',
        borderRadius: '3px',
        opacity: 0,
        transition: 'opacity 0.2s',
        fontSize: '12px',
        maxWidth: '300px',
        minWidth: '200px',
        zIndex: 99
    };

    useEffect(() => {
        drawChart(data);
    }, [data]);

    function simulateScroll(left) {
        const container = document.getElementById(`svg-container-${label}`);
        container.scrollLeft = left;
    }

    const triggerSimulate = (opt) => {
        if (opt === 'plus' && scroolState[label] < slice) {
            scroolState[label]++;
            setSlider(slider + 1);
            drawChart(data);
            // simulateScroll(768 * (scroolState[label] - 1));
        } else if (opt === 'decrement' && scroolState[label] > 1) {
            setSlider(slider - 1);
            scroolState[label]--;
            drawChart(data);
            // simulateScroll(768 * (scroolState[label] - 1));
        }
    };

    const drawChart = (rawData) => {
        let processedData2 = processData(rawData);
        let processedData;
        let sizeCircle = [];
        // if (rawData.length <= 30) {
        //     // klo rawdata krang dari 30, gausa ada filter biar graphic nya bagus dikit :) 
        //     processedData = rawData;
        // } else {
        //     // klo lebih maka di filter biar ga terlalu banyak slide
        //     processedData = processData(rawData);
        // }

        processedData = processedData2.filter(d => d.RR !== null && d.HR !== null);

        processedData.forEach(d => {
            d.date = new Date(d.date);
        });

        XCount = processedData.length;

        let page = scroolState[label] - 1;
        let maxTitik = 40;

        // Fungsi untuk mendapatkan data sesuai dengan halaman
        function getPaginatedData(data, page, maxTitik) {
            const startIndex = page * maxTitik;
            const endIndex = startIndex + maxTitik;
            return data.slice(startIndex, endIndex);
        }

        // Mendapatkan data yang diproses untuk halaman saat ini
        const paginatedData = getPaginatedData(processedData, page, maxTitik);
        processedData = paginatedData;

        let defaultColor = "rgba(7, 172, 123, 1)";

        const theme = localStorage.getItem('_isLightMode');
        if (theme == "true") { // is light state
            defaultColor = "rgba(33,113,122, 1)";
        }


        color = processedData.map((_v, i) => {
            if (i > 0) {
               
                console.log('kuning', processedData[i - 1]["avg"] - processedData[i - 1]["avg"] >= 5);
                if (processedData[i - 1]["avg"] - processedData[i]["avg"] >= 10) {
                   
                    return 'rgba(249, 39, 39, 0.8)';
                } else if (processedData[i - 1]["avg"] - processedData[i]["avg"] >= 5) {
                   
                    return 'rgba(255, 161, 0, 1)';
                } else {
                    return defaultColor; // Warna default
                }
            } else {
                return defaultColor; // Warna default
            }
        })

        sizeCircle = processedData.map((item, i) => {
            if (i > 0) {
               
                if (processedData[i - 1]["avg"] - processedData[i]["avg"] >= 10) {
                   
                    processedData[i]['label'] = "Danger";
                    return 8; // ukuran 6 untuk damger
                } else if (processedData[i - 1]["avg"] - processedData[i]["avg"] >= 5) {
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

        const tooltip = d3.select(`#tooltip${label}`);
        const lastSvg = d3.select(chartRef.current);
        lastSvg.selectAll('*').remove();

        const height = 500;
        let width = 648;
        // let width = 50 * processedData.length;
        // if (processedData.length > 30) {
        //     width = 25 * processedData.length / 2;
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

        setSlice(Math.floor(processedData2.length / maxTitik) + 1);
        // setSlice(Math.floor(width / svgWidth) + 1);

        const svg = d3.select(chartRef.current)
            .append('svg')
            .attr('height', height)
            .attr('width', width)
            .attr('class', 'svgOne bg-[#101010] dark:bg-[#FEFCF5] min-w-lg');

        const x = d3.scaleBand()
            .domain(processedData.map(d => d.date))
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(processedData, d => d["avg"]) + 10])
            .range([height - margin.bottom, margin.top]);

        const line = d3.line()
            .x(d => x(d.date))
            .y(d => y(d["avg"]));

        const linepath = svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', defaultColor)
            .attr('stroke-width', 2)
            .attr('d', line);

        // Deteksi perubahan tanggal
        let previousDate = null;

        processedData.forEach((d, i) => {
            console.log({ d })
            const currentDate = d.date.toDateString();
            if (previousDate !== currentDate) {
                // Gambar garis putus-putus di sini
                svg.append('line')
                    .attr('x1', x(d.date)) // Posisi X berdasarkan tanggal
                    .attr('y1', margin.top)
                    .attr('x2', x(d.date)) // Posisi X untuk garis vertikal
                    .attr('y2', height - margin.bottom)
                    .attr('stroke', theme == "true" ? "gray" : "white")
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '5,5'); // Mengatur garis menjadi putus-putus

                // Tambahkan label tanggal di dekat garis putus-putus
                svg.append('text')
                    .attr('x', x(d.date) + 5)
                    .attr('y', margin.top - 5)
                    .attr('fill', theme == "true" ? "gray" : "white")
                    .attr('font-size', 10)
                    .text(currentDate);
            }
            previousDate = currentDate;
        });


        const circles = svg.selectAll('circle')
            .data(processedData)
            .enter()
            .append('circle')
            .attr('cx', d => x(d.date))
            .attr('cy', d => y(d["avg"]))
            .attr('r', (d, i) => sizeCircle[i])
            .attr('fill', (d, i) => color[i % color.length])
            .on('mouseover', (event, d) => {

                let labelsPurposion;

                if(d.label == "Safe") labelsPurposion = `<span class="me-2">Aman</span><span class="aman w-[16px] h-4 rounded-full bg-green-400 text-transparent">Aa</span>`;
                if(d.label == "Warning")  labelsPurposion = `<span class="me-2">Pantau Terus</span><span class="warning w-4 h-4 rounded-full bg-orange-500 text-transparent">Aa</span>`;
                if(d.label == "Danger")   labelsPurposion = `<span class="me-2">Perlu di tindak lanjuti</span><span class="damger w-4 h-4 rounded-full bg-red-600 text-transparent">Aa</span>`;

                const [xPos, yPos] = d3.pointer(event);
                let x = xPos;
                if (scroolState[label] > 1) {
                    // x = xPos - (768 * (scroolState[label] - 1));
                }
                tooltip.style('left', `${x}px`)
                    .style('top', `${(yPos + 10)}px`)
                    .style('opacity', 1)
                    .html(`${labelsPurposion} <p>Date: ${String(d.date).split('GMT')[0]}</p> <p>Average: ${d["avg"]}</p>`);
            })
            .on('mouseout', () => {
                tooltip.style('opacity', 0);
            });

        const formatDateTime = d3.timeFormat("%H:%M:%S");

        svg.append('g')
            .attr('transform', `translate(-15,${height - margin.bottom})`)
            .call(d3.axisBottom(x)
                .tickFormat(formatDateTime)
                .ticks(XCount)
                .tickPadding(8))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', '8px');

        svg.append('g')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(d3.axisLeft(y).ticks(15));

        const zoomed = (event) => {
            const newX = event.transform.rescaleX(x);
            const newY = event.transform.rescaleY(y);
            changeZoomText(event.transform.k);

            svg.select('.x-axis').call(d3.axisBottom(newX).ticks(XCount).tickPadding(8));
            svg.select('.y-axis').call(d3.axisLeft(newY).ticks(15));

            linepath.attr('d', d3.line()
                .x(d => newX(d.date))
                .y(d => newY(d["avg"])));

            circles.attr('cx', d => newX(d.date))
                .attr('cy', d => newY(d["avg"]));
        };

        svg.call(d3.zoom()
            .scaleExtent([1, 200])
            .translateExtent([[0, 0], [width, height]])
            .on('zoom', zoomed));
    };

    const processData = (rawData) => {
        const sortedData = rawData.sort((a, b) => new Date(a.date) - new Date(b.date));

        // return sortedData;

        const uniqueValues = new Set();
        return sortedData.filter(item => {
            const value = item["avg"];
            if (!uniqueValues.has(value)) {
                uniqueValues.add(value);
                return true;
            }
            return false;
        });
    };

    const changeZoomText = (zoomV) => {
        document.getElementById(`zoom_panel_${label}`).innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
    };

    return (
        <div className='relative p-4'>
            <div data-aos="fade-right" style={styleTooltype} id={`tooltip${label}`}></div>
            <div data-aos="fade-up" className="me-auto mb-3 flex items-center sm:justify-start justify-between">
                {slice > 1 ? (
                    <div>
                        {scroolState[label] > 1 ? (
                            <button className='rounded-md bg-slate-800 dark:bg-[#FFD166] px-3 py-1 me-1' onClick={() => triggerSimulate('decrement')}>
                                <FaAngleLeft color='white' size={16} />
                            </button>
                        ) : null}

                        {scroolState[label] < slice ? (
                            <button className='rounded-md bg-slate-800 dark:bg-[#FFD166] px-3 py-1 me-1'  onClick={() => triggerSimulate('plus')}>
                                <FaAngleRight color='white' size={16} />
                            </button>

                        ) : null}
                    </div>
                ) : null}

                <div className="flex sm:flex-row flex-col">
                    <button id={`zoom_panel_${label}`} className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Slide {slider}
                    </button>
                    <button id='' className='rounded-md md:mb-0 mb-2 bg-slate-800 dark:bg-[#101010]/10 px-3 py-1 me-1 text-white dark:text-[#101010]/70 font-semibold text-sm' disabled>
                        Graphic {label}
                        <span className='ms-2 w-4 h-4 bg-[#07AC7B] dark:bg-[#217071] rounded-full text-xs text-transparent'>lLL</span>
                    </button>
                </div>
            </div>
            <div className="relative" data-aos="fade-right">
                <div className='overflow-auto' id={`svg-container-${label}`} ref={chartRef}></div>
            </div>

            <div id={`zoom_panel_${label}`}></div>
        </div>
    );
}

export default Graph3d;
