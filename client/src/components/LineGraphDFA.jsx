import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const LineGraph = ({ data, label, keyValue }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (!data || !data.length) return;

    const filteredData = selectedDate
      ? data.filter((d) => d.date_created === selectedDate)
      : data;

    if (!filteredData.length) return;

    const width = 1200;
    const height = 500;
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const parsedData = filteredData
      .filter((d) => d[keyValue] !== null && d[keyValue] !== undefined)
      .map((d) => ({
        time: d3.timeParse("%H:%M:%S")(d.time_created),
        value: +d[keyValue],
        status: d.status,
        date: d.date_created,
      }));

    if (!parsedData.length) return;

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(parsedData, (d) => d.time))
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(parsedData, (d) => d.value)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg
      .append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat("%H:%M:%S")))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .style("fill", "white");

    svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("fill", "white");

    const line = d3
      .line()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    svg
      .append("path")
      .datum(parsedData)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
      .attr("d", line);

    const tooltip = d3.select(tooltipRef.current);

    svg
      .selectAll(".point")
      .data(parsedData)
      .enter()
      .append("circle")
      .attr("class", "point")
      .attr("cx", (d) => xScale(d.time))
      .attr("cy", (d) => yScale(d.value))
      .attr("r", 6)
      .attr("fill", (d) => {
        switch (d.status) {
          case "safe":
            return "green";
          case "danger":
            return "red";
          case "warning":
            return "yellow";
          default:
            return "gray";
        }
      })
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 20}px`)
          .html(`Value: ${d.value}<br>Status: ${d.status}`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .text("Time");

    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .text(label || keyValue);
  }, [data, label, keyValue, selectedDate]);

  const uniqueDates = [...new Set(data.map((d) => d.date_created))];

  return (
    <div className="text-white">
      <div style={{ marginBottom: "20px" }}>
        <label htmlFor="date-slider" style={{ color: "white" }}>Select Date:</label>
        <select
          id="date-slider"
          onChange={(e) => setSelectedDate(e.target.value)}
        >
          <option className="text-black" value="">All Dates</option>
          {uniqueDates.map((date) => (
            <option className="text-black" key={date} value={date}>
              {date}
            </option>
          ))}
        </select>
      </div>
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          color: "white",
          padding: "5px",
          borderRadius: "5px",
          pointerEvents: "none",
          opacity: 0,
        }}
      ></div>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default LineGraph;
