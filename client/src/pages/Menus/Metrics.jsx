import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "chart.js/auto";
import Side from "../../components/Side";
import { useDispatch } from 'react-redux';

import '../../loading.css';
import DailyMetric from '../../components/DailyMetric';
import { clearLogsWithDailytMetric } from '../../redux/user/webSlice';
import AOS from 'aos';

import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

let results = []

export default function Metrics() {

  const dispatch = useDispatch();
  const { currentUser, DocterPatient } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [device, setDevice] = useState("C0680226");
  const [metode, setMetode] = useState("OC");
  const [loading, setLoading] = useState(false);

  const [medianProperty, setMedianProperty] = useState({
    sdnn: 0,
    rmssd: 0,
    pnn50: 0,
    s1: 0,
    s2: 0,
    dfa: 0,
    total: 0
  });

  useEffect(() => {
    // Mengecek apakah user sudah memiliki guid device yang valid
    if (currentUser.guid == '' || !currentUser.guid) {
      setLoading(true); // set loading page true
      //tampilkan popup error dan tendang user
      Swal.fire({
        title: "Error!",
        text: "Kamu belum memiliki guid yang valid. akses ditolak!",
        icon: "error",
        confirmButtonColor: "#3085d6",
      }).then(() => {
        return navigate('/profile');
      });

    } else {
      // jika guid device sudah valid 
      AOS.init({
        duration: 700
      })
      fetchLogs(device); // run function
    }
  }, []);

  const fetchLogs = async (device, metode) => {
    try {
      setLoading(true); // set loading page
      let url = `/api/user/test`;
      if (device) {
        url = `/api/user/test/${device}`;
      }

      // jika memakai filtering range tanggal
      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
        if (metode) url += `&method=${metode}`;  // jika metode algorithma di cantum
      } else {
        if (metode) url += `?method=${metode}`;  // jika metode algorithma di cantum
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        // Jika terjadi kesahalahn
        setDailyMetrics([]);

        dispatch(clearLogsWithDailytMetric());
        setLoading(false);
        return
      }

      const sortedLogs = data.logs.sort((a, b) => a.timestamp - b.timestamp); // Sort logs from newest to oldest

      if (data && sortedLogs.length > 0) {

        const dailyMetrictResult = data.dailyMetric; // simpan data response
        setDailyMetrics(dailyMetrictResult);

        // inisiasi awal untuk menghitung rata2
        let property = {
          tSdnn: 0,
          tRmssd: 0,
          tMin: 0,
          tMax: 0,
          tHf: 0,
          tLf: 0,
          tRatio: 0,
          dfa: 0
        }

        // loop dan tambahkan value berdasarkan key masing2
        dailyMetrictResult.forEach((val) => {
          property.tSdnn += Math.floor(val.sdnn);
          property.tRmssd += Math.floor(val.rmssd);
          property.tMin += Math.floor(val.min);
          property.tMax += Math.floor(val.max);
          property.tHf += Math.floor(val.hf);
          property.tLf += Math.floor(val.lf);
          property.tRatio += Math.floor(val.lfHfRatio);
          property.dfa += Math.floor(val.dfa)
        });

        // hitung rata - rata 
        let median = {
          sdnn: property.tSdnn / dailyMetrictResult.length,
          rmssd: property.tRmssd / dailyMetrictResult.length,
          min: property.tMin / dailyMetrictResult.length,
          max: property.tMax / dailyMetrictResult.length,
          hf: property.tHf / dailyMetrictResult.length,
          lf: property.tLf / dailyMetrictResult.length,
          lfHfRatio: property.tRatio / dailyMetrictResult.length,
          total: dailyMetrictResult.length,
          dfa: property.dfa / dailyMetrictResult.length
        }

        setMedianProperty(median); // simpan rata - rata value

      };
    }
    catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Jalankan fungsi ini ketika input range berubah
    if (startDate && endDate) {
      fetchLogs(device); // run function
    }
  }, [startDate, endDate]);

  // fungsi untuk menghitung metrics
  const calculateMetrics = (logs) => {
    const rrIntervals = logs.map((log) => log.RR);
    const nnIntervals = [];
    if (rrIntervals.length < 2) {
      // Not enough data points to calculate metrics
      return { sdnn: null, rmssd: null, pnn50: null, s1: null, s2: null };
    }
    let sumSquaredDiffs = 0; // For RMSSD
    let sumSuccessiveDiffs = 0; // For RMSSD
    let nn50Count = 0;

    for (let i = 1; i < rrIntervals.length; i++) {
      const diff = Math.abs(rrIntervals[i] - rrIntervals[i - 1]);
      nnIntervals.push(diff);

      sumSquaredDiffs += diff * diff; // Square the difference and add to sum (for RMSSD)
      if (diff > 50) {
        nn50Count++;
      }
    }

    const avgNN = nnIntervals.reduce((sum, interval) => sum + interval, 0) / nnIntervals.length;

    const squaredDiffsFromMean = nnIntervals.map((interval) => Math.pow(interval - avgNN, 2));
    const sumSquaredDiffsFromMean = squaredDiffsFromMean.reduce((sum, diff) => sum + diff, 0);

    const variance = sumSquaredDiffsFromMean / (nnIntervals.length - 1);
    const sdnn = Math.sqrt(variance);

    const rmssd = Math.sqrt(sumSquaredDiffs / nnIntervals.length);
    const pnn50 = (nn50Count / nnIntervals.length) * 100;

    // Calculate S1 & S2
    const diff1 = rrIntervals.slice(1).map((val, index) => val - rrIntervals[index]);
    const sum1 = rrIntervals.slice(1).map((val, index) => val + rrIntervals[index]);

    const s1 = Math.sqrt(diff1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / diff1.length) / Math.sqrt(2);
    const s2 = Math.sqrt(sum1.reduce((sum, val) => sum + Math.pow(val, 2), 0) / sum1.length) / Math.sqrt(2);

    // task calculate DFA
    return { sdnn, rmssd, pnn50, s1, s2 };
  };

  // const handleChangeDevice = (e) => {
  //   e.preventDefault();
  //   setDevice(e.target.value);
  //   fetchLogs(e.target.value, metode);
  // }

  // Ketika metode algorithma di ganti
  const handleChangeMetode = (e) => {
    e.preventDefault();
    setMetode(e.target.value);
    fetchLogs(device, e.target.value);
  }

  return (
    <div>
      {loading ? ( // show this screen while loading
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101010] dark:bg-[#FEFCF5]">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-t-4 border-b-4 border-[#07AC7B] dark:border-[#217170] rounded-full animate-spin " style={{ animationDuration: '0.5s' }}></div>
            <p className="text-center font-semibold mt-4 text-[#07AC7B] dark:text-[#217170]">
              Loading...
            </p>
          </div>
        </div>
      ) : null}
      <main className=''>
        <section className="bg-[#101010] dark:bg-[#FEFCF5] flex text-white dark:text-[#073B4C]">
          <Side />
          <div className="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-5">
            <div className="relative flex flex-col min-w-0 break-words bg-[#101010] dark:bg-[#FEFCF5] w-full">
              <div className="rounded-t mb-0 px-4 py-3 border-0 ">
                <div className="flex flex-wrap items-center">

                  <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl ">Metrics Data</h1>

                </div>

                <DatePicker
                  data-aos="fade-left"
                  selectsRange
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(dates) => {
                    const [start, end] = dates;
                    setStartDate(start);
                    setEndDate(end);
                  }}
                  isClearable
                  placeholderText='Cari berdasarkan range tanggal'
                  className="lg:p-2.5 p-3 md:pe-[10vw] pe-[30vw] bg-[#2C2C2C] dark:bg-[#E7E7E7] lg:mb-0 mb-4 rounded text-sm me-3 sm:me-0 mt-3 md:text-[16px] lg:min-w-[320px] md:w-fit w-full min-w-screen inline-block"
                />

                <select
                  name=""
                  id=""
                  className="lg:p-2.5 p-3 sm:mt-0 pe-8 sm:ms-3 bg-[#2C2C2C] dark:bg-[#E7E7E7] rounded text-sm w-full md:max-w-[200px]  md:text-[16px] lg:min-w-[220px] px-3 py-3"
                  onChange={handleChangeMetode}
                >
                  <option value="" disabled selected>Choose metode</option>
                  <option value="OC">OC</option>
                  <option value="IQ">IQ</option>
                  <option value="BC">BC</option>
                </select>

                {/* call component to show the table */}
                <DailyMetric dailyMetrics={dailyMetrics} medianProperty={medianProperty} />

              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}

