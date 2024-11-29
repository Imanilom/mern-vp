import React, { useEffect, useState } from 'react';
import Side from '../../components/Side'
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import AOS from 'aos';
import { Link, useParams } from 'react-router-dom';

import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';

function RiskFactor() {

  const { id } = useParams();
  const [doc, setDoc] = useState(1);
  const [lengthDoc, setLengthDoc] = useState(0);
  const [docValue, setDocValue] = useState([]);
  const [modal, setModal] = useState(false);
  const [lab, setLab] = useState(null);
  const { DoctorPatient, currentUser } = useSelector(state => state.user);
  useEffect(() => {
    AOS.init({
      duration: 1000
    })

    fetchInit();
  }, [])

  const fetchInit = async () => {
    try {
      const res = await fetch(`/api/faktorresiko/docs/${id}`);
      const data = await res.json();

      console.log({ data })
      setLengthDoc(data.docs.length);
      setDocValue(data.docs);
      setLab(data.lab__);
    } catch (error) {
      console.log({ error })
    }
  }

  const handlerDeleteDoc = async (id) => {
    console.log({ id });
    try {
      Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
      }).then(async (result) => {
        if (result.isConfirmed) {

          const res = await fetch(`/api/faktorresiko/lab/doc/${id}`, {
            method: 'DELETE'
          })

          const data = await res.json();

          Swal.fire({
            title: "Deleted!",
            text: "Your Document successfully deleted.",
            icon: "success"
          });

          window.location.reload();
        }
      });
    } catch (error) {
      console.log({ error })
    }
  }

  return (
    <main class="bg-[#101010] dark:bg-[#FEFCF5] text-white dark:text-[#073B4C] flex">
      <Side />
      <div class="w-11/12 lg:w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-8">
        {/* <ButtonOffCanvas /> */}

        {modal && docValue.length > 0 ? (
          <div className="fixed inset-0 z-50 flex flex-col  items-center justify-center bg-[#000000]/80">

            <div className="flex flex-col items-center">
              {docValue[doc - 1]['file_url'] != null ? (
                <div className="px-8 py-4 bg-white">
                  <div onClick={() => setModal(false)} className="text-end text-sm py-1 font-bold text-red-600 cursor-pointer text-[18px]">
                    Close
                  </div>
                  <img src={docValue[doc - 1]['file_url']} className='w-max-lg w-min-[70vw] h-[80vh]' alt="" srcset="" />
                </div>
              ) : null}
            </div>
          </div>

        ) : null}
        <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl mb-3 md:mb-5">Detail Labotarium</h1>
        {lab ? (
          <p className='text-sm md:text-[16px] mb-1'>Nama Lab : {lab.name_lab}</p>
        ) : null}
        {lab ? (
          <p className='text-sm md:text-[16px] mb-1'>Lokasi Lab : {lab.location}</p>
        ) : null}
        <p className='text-sm font-medium'>Total : <span className="text-[#07AC7B] dark:text-[#D39504]">{lengthDoc} Dokumen</span> </p>
        {currentUser.role != 'user' ? (
          <Link to={`/faktor-resiko/${id}/add`} className=" w-full text-[#07AC7B] dark:text-[#D39504] justify-end flex text-end md:my-3 mb-3 mt-8 font-medium text-xs uppercase cursor-pointer">Tambahkan dokumen lab terbaru</Link>

        ) : null}

        <div class="relative flex flex-col mt-3 min-w-0 break-words w-full mb-6 shadow-lg rounded ">
          <div class="rounded-t mb-0 px-4 py-3 border-0 bg-[#363636]/30 dark:bg-[#217170]">
            <div class="flex flex-wrap items-center">
              <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                {docValue.length > 0 ? (
                  <>
                    <p className='font-medium text-white dark:text-white'>Dokumen {doc}</p>
                    {currentUser.role != 'user' ? (
                      <h3 onClick={() => handlerDeleteDoc(docValue[doc - 1]['_id'])} class="font-semibold text-blueGray-700 text-red-600 cursor-pointer text-sm whitespace-nowrap">Hapus Dokumen</h3>
                    ) : null}
                  </>
                ) : (
                  <p className='font-medium text-sm'>Belum ada dokumen yang tersedia di lab ini</p>
                )}
              </div>
              <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
                <Link to={'/faktor-resiko'} class=" text-xs font-semibold uppercase py-1 rounded outline-none focus:outline-none mb-1 ease-linear text-[#005A8F] dark:text-[#FFD166] transition-all duration-150" type="button">Kembali</Link>
                {doc > 1 ? (
                  <button onClick={() => setDoc(doc - 1)} class="blue text-xs font-bold uppercase ps-4 py-1 rounded outline-none focus:outline-none mb-1 ease-linear transition-all duration-150" type="button">{"<-"} Back</button>
                ) : null}
                {doc + 1 > lengthDoc ? null : (

                  <button onClick={() => setDoc(doc + 1)} class="blue ps-4 text-xs font-bold uppercase py-1 rounded outline-none focus:outline-none mb-1 ease-linear transition-all duration-150" type="button">Next {"->"}</button>
                )}

              </div>
            </div>
          </div>

          <div class="block w-full overflow-x-auto">
            {docValue.length > 0 ? (

              <table class="items-center bg-transparent w-full  ">
                <thead>
                  <tr className='bg-[#2c2c2c] dark:bg-[#E7E7E7]'>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Tanggal
                    </th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      {new Intl.DateTimeFormat('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: '2-digit'
                      }).format(new Date(docValue[doc - 1]['Date']))}
                    </th>
                    <th></th>
                    <th></th>
                  </tr>
                  <tr className='bg-[#141414] dark:bg-[#CBCBCB]'>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Ditulis Oleh
                    </th>

                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      {docValue ? docValue[doc - 1]['docter']['name'] : null}
                    </th>
                    <th></th>
                    <th></th>
                  </tr>
                  <tr className='bg-[#2c2c2c] dark:bg-[#E7E7E7]'>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Bukti Dokumen
                    </th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      {docValue[doc - 1]['file_url'] != null ? (
                        <div>
                          Tersedia | <span onClick={() => setModal(true)} className='font-semibold cursor-pointer darkgreen' >Lihat Bukti Document</span>
                        </div>

                      ) : (
                        <div>
                          Kosong | Docter tidak memberikan Bukti Document
                        </div>

                      )}
                    </th>
                    <th></th>
                    <th></th>
                  </tr>
                  <tr className='bg-[#141414] dark:bg-[#CBCBCB]'>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-4 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left"></th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left"></th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left"></th>
                  </tr>
                </thead>
                <thead>
                  <tr className='bg-[#141414]'>
                    <th></th>
                    <th></th>

                  </tr>
                </thead>

                <thead>
                  <tr className='bg-[#2c2c2c] dark:bg-[#E7E7E7]'>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      No
                    </th>
                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Deksripsi
                    </th>

                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                      Penilaian
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {docValue[doc - 1]['penilaian'].length > 0 ? (
                    docValue[doc - 1]['penilaian'].map((data, _i) => {
                      return (
                        <tr className={_i % 2 ? 'bg-[#2c2c2c] dark:bg-[#E7E7E7]' : 'bg-[#141414] dark:bg-[#CBCBCB]'}>
                          <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                            {_i + 1}
                          </th>

                          <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs p-4">
                            {data.label}
                          </td>

                          <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                            <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                            {data.jawaban}
                          </td>
                        </tr>
                      )
                    })
                  ) : null}

                  {/* <tr className="bg-[#2c2c2c]">
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      2
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      Sex
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      Jenis Kelamin
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      0 = Perempuan <br />
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      1 = Laki - Laki
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr>
                  <tr className='bg-[#141414]'>
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      3
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      cp
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      Tipe nyeri dada
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      1 = typical angina, 2 = atypical angina,<br />
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      3 = non-anginal pain, 4= asymptomatic
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr>
                  <tr className="bg-[#2c2c2c]">
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      4
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      trestbps
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      Tekanan darah istirahat (mmHg)
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      [0, ]
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr>
                  <tr className='bg-[#141414]'>
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      5
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      chol
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      Kolesterol (md/dl)
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      [0, ]
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr>
                  <tr className="bg-[#2c2c2c]">
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      6
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      fbs
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      Gula darah puasa {'>'} 120mg/dl
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      0 = salah, <br />
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      1 = benar
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr>
                  <tr className='bg-[#141414]'>
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      7
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      restecg
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      Hasil ECG saat istirahat
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      0 = normal, <br />
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      1 = ketidaknormalan pada ST-T <br />
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      2 = kemungkinan terjadi ventrikuler left hipertrofi
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr>
                  <tr className="bg-[#2c2c2c]">
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      8
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      thalach
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      Detak jantung maksimum
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      [0, ]
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr>
                  <tr className='bg-[#141414]'>
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      9
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      exang
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      Latihan yang diinduksi angina
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      0 = tidak <br />
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      1 = benar
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr>
                  <tr className="bg-[#2c2c2c]">
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      10
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      oldpeak
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs p-4">
                      Depresi ST yang diinduksi oleh olahraga relatif terhadap istirahat
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      [0, ]
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr>
                  <tr className='bg-[#141414]'>
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      11
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      slope
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                      Kemiringan segmen ST pada latihan puncak
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      1 = up-sloping
                      <br />
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      2 = flat
                      <br />
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      3 = down-sloping
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr>
                  <tr className="bg-[#2c2c2c]">
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      12
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      ca
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                      Jumlah vessel utama yang diwarnai oleh flourosopy
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      0-3
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr>
                  <tr className='bg-[#141414]'>
                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                      13
                    </th>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                      thal
                    </td>
                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      Jenis cacat
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      3 = normal
                      <br />
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      6 = fixed defect
                      <br />
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      7 = reversable defect
                    </td>
                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                      <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                      -
                    </td>
                  </tr> */}
                </tbody>

              </table>
            ) : null}
          </div>
        </div>
      </div>
    </main >
  )
}

export default RiskFactor