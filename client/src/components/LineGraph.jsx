import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const LineGraph = ({ data, label, keyValue, color }) => {
  const svgRef = useRef();
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (!data || !data.length) return;

    // Filter data by selected date
    const filteredData = selectedDate
      ? data.filter((d) => d.date_created === selectedDate)
      : data;

    if (!filteredData.length) return;

    // Set up dimensions
    const width = 1200; // Increased width
    const height = 500; // Adjusted height
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };

    // Remove existing SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    // Create the SVG container
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Parse the data
    const parsedData = filteredData
      .filter((d) => d[keyValue] !== null && d[keyValue] !== undefined)
      .map((d) => ({
        time: d3.timeParse("%H:%M:%S")(d.time_created),
        value: +d[keyValue],
        date: d.date_created,
      }));

    if (!parsedData.length) return;

    // Set up scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(parsedData, (d) => d.time))
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(parsedData, (d) => d.value)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Add x-axis
    svg
      .append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat("%H:%M:%S")))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .style("fill", "white"); // Set x-axis text color to white

    // Add y-axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("fill", "white"); // Set y-axis text color to white

    // Add line
    const line = d3
      .line()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    svg
      .append("path")
      .datum(parsedData)
      .attr("fill", "none")
      .attr("stroke", color || "steelblue")
      .attr("stroke-width", 2)
      .attr("d", line);

    // Add vertical dashed lines for date changes
    const dateChanges = d3.group(parsedData, (d) => d.date);
    let labelOffset = 0; // Initial label offset
    const labelSpacing = 50; // Minimum space between labels

    dateChanges.forEach((group, date, index) => {
      const firstPoint = group[0];
      const xPos = xScale(firstPoint.time);

      // Draw vertical dashed line
      svg
        .append("line")
        .attr("x1", xPos)
        .attr("y1", margin.top)
        .attr("x2", xPos)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "4");

      // Adjust label position to avoid overlap
      if (xPos - labelOffset < labelSpacing) {
        labelOffset += labelSpacing; // Push label further
      } else {
        labelOffset = xPos;
      }

      // Add date label
      svg
        .append("text")
        .attr("x", labelOffset)
        .attr("y", margin.top + 10)
        .attr("fill", "white") // Set label color to white
        .attr("font-size", "12px")
        .attr("text-anchor", "start")
        .text(`${date}`);
    });

    // Add labels
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .attr("fill", "white") // Set x-axis label color to white
      .text("Time");

    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("fill", "white") // Set y-axis label color to white
      .text(label || keyValue);
  }, [data, label, keyValue, color, selectedDate]);

  // Extract unique dates for the slider
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
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default LineGraph;