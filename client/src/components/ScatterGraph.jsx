import { useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import { FaAngleLeft, FaAngleRight } from "react-icons/fa";
import '../chart.css';
import AOS from 'aos';

let scroolState = 1;

function ScatterGraph({ data, label, keyValue, color }) {
    useEffect(() => {
        AOS.init({ duration: 700 });
    }, []);

    const chartRef = useRef();
    const YCount = 10;
    const slice = 1;

    const triggerSimulate = (opt) => {
        if (opt === 'plus' && scroolState < slice) {
            scroolState++;
            simulateScroll(768 * (scroolState - 1));
        } else if (opt === 'decrement' && scroolState > 1) {
            scroolState--;
            simulateScroll(768 * (scroolState - 1));
        }
    };

    function simulateScroll(left) {
        const container = document.getElementById(`svg-container_${label}`);
        container.scrollLeft = left;
    }

    const poincareData = (data) => {
        if (!data) return [];
        const rr = data.map(item => item.RR);
        const date = data.map(item => item.create_at);
        const activity = data.map(item => item.activity);

        return rr.slice(1).map((value, index) => ([
            rr[index],
            value,
            date[index],
            activity[index],
        ]));
    };

    useEffect(() => {
        const result2 = poincareData(data);
        const result = result2.filter(d => d[0] !== null && d[1] !== null);
        drawChart(result);
    }, [data]);

    const changeZoomText = (zoomV) => {
        document.getElementById(`zoom_panel_${label}`).innerHTML = `Zoom level ${zoomV.toFixed(1)}`;
    };

    const drawChart = (data) => {
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

        const margin = { top: 20, right: 20, bottom: 30, left: 30 };

        const svg = d3.select(chartRef.current)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', '#333') // Latar belakang gelap
            .attr('class', 'svgTwo dark:bg-gray-900');

        const x = d3.scaleLinear()
            .domain([d3.min(data, d => d[0]) - 50, d3.max(data, d => d[0])])
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d[1]) + 100])
            .range([height - margin.top, margin.bottom]);

        const line = d3.line()
            .x(d => x(d[0]))
            .y(d => y(d[1]));

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
                    .html(`<p>Date: ${String(d[2]).split('GMT')[0]}</p>
                           <p>Aktivitas Pasien: ${d[3] || `Tidak ada riwayat`}</p>
                           <p>Point Care: [${d[0]}, ${d[1]}]</p>`);
            })
            .on('mouseout', () => {
                tooltip.style('opacity', 0);
            });

        svg.append('g')
            .attr('transform', `translate(0, ${height - margin.bottom - 10})`)
            .attr('fontSize', 8)
            .call(d3.axisBottom(x).ticks(YCount).tickPadding(10))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end');

        svg.append('g')
            .attr('transform', `translate(${margin.left},${-margin.top})`)
            .call(d3.axisLeft(y).ticks(YCount));

        const zoomed = (e) => {
            const newX = e.transform.rescaleX(x);
            const newY = e.transform.rescaleY(y);
            changeZoomText(e.transform.k);

            svg.selectAll('circle')
                .attr('cx', d => newX(d[0]))
                .attr('cy', d => newY(d[1]));

            linepath.attr('d', d3.line()
                .x(d => newX(d[0]))
                .y(d => newY(d[1]))
            );
        };

        svg.call(d3.zoom()
            .scaleExtent([1, 120])
            .translateExtent([[0, 0], [width, height]])
            .on('zoom', zoomed));
    };

    return (
        <div className='relative p-4 bg-gray-800 text-white'>
            <div id="tooltip" className="absolute bg-gray-700 text-white p-2 rounded-md opacity-0"></div>
            <div className="mb-3 flex items-center justify-between">
                {slice > 1 && (
                    <div>
                        <button
                            className='rounded-md bg-gray-700 px-3 py-1'
                            onClick={() => triggerSimulate('decrement')}
                        >
                            <FaAngleLeft size={16} />
                        </button>
                        <button
                            className='rounded-md bg-gray-700 px-3 py-1'
                            onClick={() => triggerSimulate('plus')}
                        >
                            <FaAngleRight size={16} />
                        </button>
                    </div>
                )}
                <div className="flex gap-2">
                    <button
                        id={`zoom_panel_${label}`}
                        className='rounded-md bg-gray-700 px-3 py-1'
                        disabled
                    >
                        Zoom level 1
                    </button>
                    <button
                        className='rounded-md bg-gray-700 px-3 py-1'
                        disabled
                    >
                        Graphic {label}
                    </button>
                </div>
            </div>
            <div id={`svg-container_${label}`} ref={chartRef}></div>
        </div>
    );
}

export default ScatterGraph;
