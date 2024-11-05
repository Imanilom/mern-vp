import { useRef, useState, useEffect } from 'react';

import * as d3 from 'd3';
import { FaAngleLeft } from "react-icons/fa";
import { FaAngleRight } from "react-icons/fa";
import '../chart.css';
import AOS from 'aos';


let scroolState = 1;


function ScatterGraph({ data, label, keyValue, color }) {
    useEffect(() => {
        AOS.init({
            duration: 700
        })
    }, [])
    const chartRef = useRef();
    const YCount = 10;
    const slice = 1;
    const triggerSimulate = (opt) => {
        if (opt == 'plus' && scroolState < slice) {
            scroolState++;
            simulateScroll(768 * (scroolState - 1))
        } else if (opt == 'decrement' && scroolState > 1) {
            scroolState--;
            simulateScroll((768 * (scroolState - 1)));
        }
    }

    function simulateScroll(left) {
        const container = document.getElementById(`svg-container_${label}`);
        container.scrollLeft = left;
    }

    const poincareData = (data) => {
        if (!data) return;

        const rr = data.map(item => item.RR);
        let dataResult = rr.slice(1).map((value, index) => ([
            rr[index], // this X
            value, // this Y
        ])); // array

        let finaldata = [];

        const date = data.map(item => item.create_at);
        const activity = data.map(item => item.activity);
        dataResult.map((v, i) => {
            finaldata.push([...v, date[i], activity[i]])
            //this will looks like
            /**
             * [89, 90, Thu Aug 29 2024 14:43:52 GMT+0700 (Indochina Time)]
             */
        })

        return finaldata;
    };

    useEffect(() => {
        const result2 = poincareData(data);
        console.log({ result2 })
        const result = result2.filter(d => d[0] !== null && d[1] !== null);
        drawChart(result)
    }, [data])

    const changeZoomText = (zoomV) => {
        document.getElementById(`zoom_panel_${label}`).innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
    }

    // const drawChart = (data) => {
    //     console.log({data}, 'Scatter')
    //     // mengambil element tooltip
    //     const tooltip = d3.select('#tooltip');
    //     // reset gambar svg 
    //     const lastSvg = d3.select(chartRef.current);
    //     lastSvg.selectAll('*').remove();

    //     // porperty canvas chart
    //     const height = 500;
    //     const width = 768 * slice;
    //     const margin = { top: 20, right: 20, bottom: 30, left: 40 }

    //     const svg = d3.select(chartRef.current)
    //         .append('svg')
    //         .attr('width', width)
    //         .attr('height', height)
    //         .style('background', 'white')
    //         .attr('class', 'svgTwo bgg-bl')

    //     const x = d3.scaleLinear()
    //         .domain([d3.min(data, d => d[0]) - 50, d3.max(data, d => d[0])])
    //         .range([margin.left, width - margin.right]);

    //     const y = d3.scaleLinear()
    //         .domain([0, d3.max(data, d => d[1]) + 100])
    //         .range([height - margin.top, margin.bottom])

    //     const line = d3.line()
    //         .x(d => x(d[0]))
    //         .y(d => y(d[1]))

    //     const linepath = svg.append('path')
    //         .datum(data)
    //         .attr('fill', 'none')
    //         .attr('stroke', 'transparent')
    //         .attr('stroke-width', 2)
    //         .attr('d', line);

    //     const circles = svg.selectAll("circle")
    //         .data(data)
    //         .enter()
    //         .append("circle")
    //         .attr("cx", d => x(d[0]))
    //         .attr("cy", d => y(d[1]))
    //         .attr("r", 5)
    //         .attr("fill", (d, i) => color[i])
    //         .on('mouseover', (event, d) => {
    //             const [xPos, yPos] = d3.pointer(event); // mouse x, y
    //             let x = xPos + 10;
    //             if (scroolState > 1) {
    //                 // x = xPos - (768 * (scroolState - 1));
    //                 x = xPos - 768;
    //                 console.log(x, xPos, (768 * (scroolState - 1)))
    //             }
    //             console.log({ scroolState }, (xPos - (scroolState * 768) + 10), xPos, { x }, tooltip);

    //             tooltip.style('left', `${x}px`) // agar tooltip bisa muncul meski di scrool overflow
    //                 .style('top', `${(yPos + 10)}px`)
    //                 .style('opacity', 1)
    //                 .html(`<p>Date: ${String(d[2]).split('GMT')[0]} </p> <p>Aktivitas Pasien: ${d[3] == undefined ? `Tidak ada riwayat` : d[3]}</p> <p>Point Care: [${d[0]}, ${d[1]}]</p>`);

    //         })

    //         .on('mouseout', () => {
    //             tooltip.style('opacity', 0);
    //         });

    //     //membuat label x
    //     svg.append('g')
    //         .attr('transform', `translate(0, ${height - margin.bottom - 10})`)
    //         .call(d3.axisBottom(x)
    //             .ticks(YCount)
    //             .tickPadding(10)
    //         )
    //         .selectAll("line") // Memilih elemen line pada ticks
    //         .attr("stroke", "rgba(170, 39, 245, 0.9)") // Mengubah warna tick menjadi ungu
    //         .selectAll('text')
    //         .attr('transform', 'rotate(-35)') // Memutar label 45 derajat
    //         .style('text-anchor', 'end') // Menyelaraskan teks ke ujung


    //     // membuat label y
    //     svg.append('g')
    //         .attr('transform', `translate(${margin.left},${-margin.top})`)
    //         .call(d3.axisLeft(y)
    //             .ticks(YCount)
    //         )

    //     //zoom event
    //     const chartGroup = svg.append('g');
    //     const zoomed = (e) => {
    //         const newX = e.transform.rescaleX(x);
    //         const newY = e.transform.rescaleY(y);

    //         console.log('oke zoom')

    //         changeZoomText(e.transform.k);

    //         x.call(d3.axisBottom(newX)
    //             .ticks(YCount)
    //             .tickPadding(10))

    //         y.call(d3.axisLeft(newY)
    //             .ticks(YCount))

    //         linepath.attr('d', d3.line()
    //             .x(d => newX(d[0]))
    //             .y(d => newY(d[1]))
    //         );

    //         // const linepath = svg.append('path')
    //         // .datum(data)
    //         // .attr('fill', 'none')
    //         // .attr('stroke', 'transparent')
    //         // .attr('stroke-width', 2)
    //         // .attr('d', line);

    //         circles
    //             .attr('cx', d => newX(d[0]))
    //             .attr('cy', d => newY(d[1]))
    //     }

    //     // zoom trigger event
    //     svg.call(d3.zoom()
    //         .scaleExtent([1, 120])
    //         .translateExtent([[0, 0], [width, height]])
    //         .on('zoom', zoomed));
    // }

    const drawChart = (data) => {
        console.log({ data }, 'Scatter')

        const tooltip = d3.select('#tooltip');
        const lastSvg = d3.select(chartRef.current);
        lastSvg.selectAll('*').remove();

        const height = 500;
        let width = 768 * slice;


        if (window.innerWidth > 980) {
            width = 768;
        } else if (window.innerWidth > 540) {
            width = window.innerWidth * 0.8;
        } else {
            width = window.innerWidth * 0.7;
        }

        const margin = { top: 20, right: 20, bottom: 30, left: 40 }

        const svg = d3.select(chartRef.current)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', 'white')
            .attr('class', 'svgTwo bgg-bl')

        const x = d3.scaleLinear()
            .domain([d3.min(data, d => d[0]) - 50, d3.max(data, d => d[0])])
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d[1]) + 100])
            .range([height - margin.top, margin.bottom])

        const line = d3.line()
            .x(d => x(d[0]))
            .y(d => y(d[1]))

        const linepath = svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', 'transparent')
            .attr('stroke-width', 2)
            .attr('d', line);

        const circles = svg.selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", d => x(d[0]))
            .attr("cy", d => y(d[1]))
            .attr("r", 5)
            .attr("fill", (d, i) => color[i])
            .on('mouseover', (event, d) => {
                const [xPos, yPos] = d3.pointer(event);
                let x = xPos + 10;
                if (scroolState > 1) {
                    x = xPos - 768;
                }
                tooltip.style('left', `${x}px`)
                    .style('top', `${(yPos + 10)}px`)
                    .style('opacity', 1)
                    .html(`<p>Date: ${String(d[2]).split('GMT')[0]} </p> <p>Aktivitas Pasien: ${d[3] == undefined ? `Tidak ada riwayat` : d[3]}</p> <p>Point Care: [${d[0]}, ${d[1]}]</p>`);
            })
            .on('mouseout', () => {
                tooltip.style('opacity', 0);
            });

        // Membuat sumbu x dan y sebagai variabel tersendiri
        const xAxis = svg.append('g')

            .attr('transform', `translate(0, ${height - margin.bottom - 10})`)
            .attr('fontSize', 8)
            .call(d3.axisBottom(x)
                .ticks(YCount)
                .tickPadding(10)
            )


        xAxis
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end'); // Agar teks tetap rapi


        const yAxis = svg.append('g')
            .attr('transform', `translate(${margin.left},${-margin.top})`)
            .call(d3.axisLeft(y)
                .ticks(YCount)
            );

        // Fungsi zoom
        const zoomed = (e) => {
            try {


                const newX = e.transform.rescaleX(x);
                const newY = e.transform.rescaleY(y);

                changeZoomText(e.transform.k);

                // Update sumbu dengan skala yang sudah di-zoom
                xAxis.call(d3.axisBottom(newX).ticks(YCount).tickPadding(10))  
                .selectAll('text')
                .attr('transform', 'rotate(-45)')
                .style('text-anchor', 'end'); // Agar teks tetap rapi

                yAxis.call(d3.axisLeft(newY).ticks(YCount));

                // Update garis dan lingkaran berdasarkan skala baru
                linepath.attr('d', d3.line()
                    .x(d => newX(d[0]))
                    .y(d => newY(d[1]))
                );

                circles
                    .attr('cx', d => newX(d[0]))
                    .attr('cy', d => newY(d[1]))

            } catch (err) {
                console.log({ err })
            }
        }

        svg.call(d3.zoom()
            .scaleExtent([1, 120])
            .translateExtent([[0, 0], [width, height]])
            .on('zoom', zoomed));
    }


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

    return (
        <div className='relative p-4'>
            <div data-aos="fade-right" id="tooltip" style={styleTooltype}></div>
            <div className="me-auto mb-3 flex items-center sm:justify-start justify-between">
                {slice > 1 ? (
                    <div>
                        <button className='rounded-md bg-slate-800 px-3 py-1 border me-1' onClick={() => triggerSimulate('decrement')}>
                            <FaAngleLeft color='white' size={16} />

                        </button>
                        <button className='rounded-md bg-slate-800 px-3 py-1 border me-1' onClick={() => triggerSimulate('plus')}>
                            <FaAngleRight color='white' size={16} />
                        </button>
                    </div>
                ) : null}
                <div data-aos="fade-up" className="flex sm:flex-row flex-col md:gap-0 gap-2">
                    <button id={`zoom_panel_${label}`} className='rounded-md bg-slate-800 px-3 py-1 me-1 text-white font-semibold text-sm' disabled>
                        Zoom level 1
                    </button>
                    <button id='' className='rounded-md bg-blue-500 px-3 py-1 me-1 text-white font-semibold text-sm' disabled>
                        Graphic {label}
                    </button>
                </div>
            </div>

            <div data-aos="fade-right" className="svg-container" id={`svg-container_${label}`} ref={chartRef}></div>
        </div>
    )
}


export default ScatterGraph;