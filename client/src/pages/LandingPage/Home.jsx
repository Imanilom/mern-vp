import React from 'react'
import Hero1 from './../../assets/images/hero.jpg';

import image1 from './../../assets/images/doctor1.png';
import image2 from './../../assets/images/doctor2.png';
import image3 from './../../assets/images/doctor3.png';
import image4 from './../../assets/images/doctor4.png';
import image5 from './../../assets/images/doctor5.png';
import image6 from './../../assets/images/doctor6.png';
import image7 from './../../assets/images/doctor7.png';


import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <section className='flex flex-col gap-24'>
      {/* Hero 1 Explain Smart Future e-healt */}

      <div className="w-10/12 mx-auto py-16 flex flex-col md:justify-between md:flex-row gap-8 items-center">
        <div className="flex flex-col gap-4  md:w-8/12 lg:w-5/12">
          <h1 className='text-[28px] md:text-[40px] font-bold'>
            Smart Future <span className='text-[#B47AEA]'>eHealth</span> ,
            <br />for who? </h1>

          <p className="text-[16px]">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,</p>

          <button onClick={() => navigate('/sign-in')} className='rounded-md w-fit text-[#FFFFFF] hover:shadow-xl duration-200 font-semibold bg-[#B47AEA] px-6 py-2'>Lets Start!</button>
        </div>

        <div>
          <img src={image1} alt="" />
        </div>

      </div>

      {/* End of explain */}


      {/* Traditional vs Smart Health for Individual Care */}
      <div className="w-10/12 mx-auto flex flex-col gap-12 md:gap-4">
        {/* text */}
        <div className="text-[28px] md:text-[40px] text-center font-bold flex flex-col gap-4 mb-8">
          <h1>Traditional vs <span className='text-[#B47AEA]'>Smart Health</span>  for Individual Care</h1>
          <p className='text-[20px]'>Lets compare them</p>
        </div>

        {/* Traditional health */}
        <div className="flex flex-col gap-6">
          <div className='flex flex-col md:items-center md:flex-row font-bold text-center gap-4 md:justify-center'>
            <img src={image2} alt="" className='w-fit' />

            {/* text with persentation */}
            <div className="text md:w-fit text-center md:text-start">
              <h3 className='text-[24px]'>
                Traditional Health
              </h3>
              <div className='text-[48px] text-red-600'>
                87%
                <span className='text-[24px]'> Effective</span>
              </div>
            </div>

          </div>

          {/* description */}
          <p className='md:font-semibold text-[16px] md:text-[16px] md:mt-4 text-center md:px-24 lg:px-44'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, magna aliqua. Ut enim ad minim veniam,</p>

        </div>

        {/* Smart health */}

        <div className="flex flex-col gap-6">
          <div className='flex flex-col md:items-center md:flex-row font-bold text-center gap-4 md:justify-center'>


            {/* text with persentation */}
            <div className="text md:w-fit md:text-start">
              <h3 className='text-[24px]'>
                Smart ehealth
              </h3>
              <div className='text-[48px] text-green-500'>
                100%
                <span className='text-[24px]'> Effective</span>
              </div>
            </div>

            {/* image */}
            <img src={image3} alt="" className='w-fit' />

          </div>

          {/* description */}
          <p className='md:font-semibold text-[16px] md:text-[16px] md:mt-4 text-center md:px-24 lg:px-44'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, magna aliqua. Ut enim ad minim veniam,</p>

        </div>

      </div>

      {/* Traditional vs Smart Health for Individual Care END */}


      {/* What are the Smart eHealth tasks to do? */}
      <div className="w-10/12 mx-auto flex-col flex gap-12">

        {/* text */}
        <h2 className='font-bold text-[24px] md:text-[40px] text-center'>What are the
          <span className='text-[#B47AEA]'> Smart eHealth </span>
          tasks to do?  </h2>


        {/* Collection of card */}

        <div className="flex flex-col gap-6 justify-center items-center md:flex-row  md:flex-wrap">
          <card className="max-w-[305px] lg:min-w-[375px] pt-6 lg:pt-16  rounded-lg border border-[#B47AEA] flex-col gap-3 flex group px-4 py-8  hover:shadow-xl hover:translate-y-[-12px] hover:bg-[#B47AEA]/10 hover:border-[#B47AEA]/20 duration-500">

            {/* icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path className='fill-[#474444] group-hover:fill-[#B47AEA]' fill="" d="M20.13 4.155a5 5 0 0 0-4.39-1.07A6 6 0 0 0 12 5.665a6 6 0 0 0-3.72-2.58a5.09 5.09 0 0 0-4.4 1c-1.58 1.38-2.45 4.44-1.46 7.54c.112.342.246.676.4 1c.04.075.077.152.11.23c2.57 5.24 8.51 8 8.77 8.13a.672.672 0 0 0 .31.07a.702.702 0 0 0 .31-.07c.25-.11 6.25-2.85 8.8-8.15l.08-.17c.158-.34.295-.691.41-1.05c.94-3 .08-6.06-1.48-7.46m-.31 7.93c-.14.314-.3.618-.48.91h-3.31a1 1 0 0 1-.83-.45l-1.05-1.56l-2.23 4.46a1 1 0 0 1-.73.54h-.16a1 1 0 0 1-.71-.3l-2.71-2.7H4.7a10.595 10.595 0 0 1-.5-1a6.336 6.336 0 0 1-.38-1h4.21a.999.999 0 0 1 .71.29l2 2l2.38-4.76a1 1 0 0 1 .84-.55a1 1 0 0 1 .89.44l1.7 2.56h3.7a6.572 6.572 0 0 1-.43 1.12" /></svg>

            {/* title */}
            <h4 className="text-[18px] font-bold">Lorem ipsum dolor sit amet, consectetur adipiscing</h4>

            {/* text description */}
            <div className="text-[16px]">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            </div>
          </card>

          <card className="max-w-[305px] lg:min-w-[375px]  pt-6 lg:pt-16  rounded-lg border border-[#B47AEA] flex-col gap-3 flex group px-4 py-8 hover:shadow-xl hover:translate-y-[-12px] hover:bg-[#B47AEA]/10 hover:border-[#B47AEA]/20 duration-500">

            {/* icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path className='fill-[#474444] group-hover:fill-[#B47AEA]' fill="" d="M20.13 4.155a5 5 0 0 0-4.39-1.07A6 6 0 0 0 12 5.665a6 6 0 0 0-3.72-2.58a5.09 5.09 0 0 0-4.4 1c-1.58 1.38-2.45 4.44-1.46 7.54c.112.342.246.676.4 1c.04.075.077.152.11.23c2.57 5.24 8.51 8 8.77 8.13a.672.672 0 0 0 .31.07a.702.702 0 0 0 .31-.07c.25-.11 6.25-2.85 8.8-8.15l.08-.17c.158-.34.295-.691.41-1.05c.94-3 .08-6.06-1.48-7.46m-.31 7.93c-.14.314-.3.618-.48.91h-3.31a1 1 0 0 1-.83-.45l-1.05-1.56l-2.23 4.46a1 1 0 0 1-.73.54h-.16a1 1 0 0 1-.71-.3l-2.71-2.7H4.7a10.595 10.595 0 0 1-.5-1a6.336 6.336 0 0 1-.38-1h4.21a.999.999 0 0 1 .71.29l2 2l2.38-4.76a1 1 0 0 1 .84-.55a1 1 0 0 1 .89.44l1.7 2.56h3.7a6.572 6.572 0 0 1-.43 1.12" /></svg>

            {/* title */}
            <h4 className="text-[18px] font-bold">Lorem ipsum dolor sit amet, consectetur adipiscing</h4>

            {/* text description */}
            <div className="text-[16px]">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            </div>
          </card>

          <card className="max-w-[305px] lg:min-w-[375px]  pt-6 lg:pt-16  rounded-lg border border-[#B47AEA] flex-col gap-3 flex group px-4 py-8  hover:shadow-xl hover:translate-y-[-12px] hover:bg-[#B47AEA]/10 hover:border-[#B47AEA]/20 duration-500">

            {/* icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path className='fill-[#474444] group-hover:fill-[#B47AEA]' fill="" d="M20.13 4.155a5 5 0 0 0-4.39-1.07A6 6 0 0 0 12 5.665a6 6 0 0 0-3.72-2.58a5.09 5.09 0 0 0-4.4 1c-1.58 1.38-2.45 4.44-1.46 7.54c.112.342.246.676.4 1c.04.075.077.152.11.23c2.57 5.24 8.51 8 8.77 8.13a.672.672 0 0 0 .31.07a.702.702 0 0 0 .31-.07c.25-.11 6.25-2.85 8.8-8.15l.08-.17c.158-.34.295-.691.41-1.05c.94-3 .08-6.06-1.48-7.46m-.31 7.93c-.14.314-.3.618-.48.91h-3.31a1 1 0 0 1-.83-.45l-1.05-1.56l-2.23 4.46a1 1 0 0 1-.73.54h-.16a1 1 0 0 1-.71-.3l-2.71-2.7H4.7a10.595 10.595 0 0 1-.5-1a6.336 6.336 0 0 1-.38-1h4.21a.999.999 0 0 1 .71.29l2 2l2.38-4.76a1 1 0 0 1 .84-.55a1 1 0 0 1 .89.44l1.7 2.56h3.7a6.572 6.572 0 0 1-.43 1.12" /></svg>

            {/* title */}
            <h4 className="text-[18px] font-bold">Lorem ipsum dolor sit amet, consectetur adipiscing</h4>

            {/* text description */}
            <div className="text-[16px]">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            </div>
          </card>

          <card className="max-w-[305px] lg:min-w-[375px] pt-6 lg:pt-16 rounded-lg border border-[#B47AEA] flex-col gap-3 flex group px-4 py-8  hover:shadow-xl hover:translate-y-[-12px] hover:bg-[#B47AEA]/10 hover:border-[#B47AEA]/20 duration-500">

            {/* icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path className='fill-[#474444] group-hover:fill-[#B47AEA]' fill="" d="M20.13 4.155a5 5 0 0 0-4.39-1.07A6 6 0 0 0 12 5.665a6 6 0 0 0-3.72-2.58a5.09 5.09 0 0 0-4.4 1c-1.58 1.38-2.45 4.44-1.46 7.54c.112.342.246.676.4 1c.04.075.077.152.11.23c2.57 5.24 8.51 8 8.77 8.13a.672.672 0 0 0 .31.07a.702.702 0 0 0 .31-.07c.25-.11 6.25-2.85 8.8-8.15l.08-.17c.158-.34.295-.691.41-1.05c.94-3 .08-6.06-1.48-7.46m-.31 7.93c-.14.314-.3.618-.48.91h-3.31a1 1 0 0 1-.83-.45l-1.05-1.56l-2.23 4.46a1 1 0 0 1-.73.54h-.16a1 1 0 0 1-.71-.3l-2.71-2.7H4.7a10.595 10.595 0 0 1-.5-1a6.336 6.336 0 0 1-.38-1h4.21a.999.999 0 0 1 .71.29l2 2l2.38-4.76a1 1 0 0 1 .84-.55a1 1 0 0 1 .89.44l1.7 2.56h3.7a6.572 6.572 0 0 1-.43 1.12" /></svg>

            {/* title */}
            <h4 className="text-[18px] font-bold">Lorem ipsum dolor sit amet, consectetur adipiscing</h4>

            {/* text description */}
            <div className="text-[16px]">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            </div>
          </card>

        </div>
      </div>
      {/* What are the Smart eHealth tasks to do? END */}


      {/* What are vidyamedic do?, What we do to your data?, How we build? */}
      <div className="flex-col flex gap-12 md:px-4">

        {/* What are vidyamedic do? */}
        <div className="flex md:flex-row flex-col gap-4 md:gap-8 md:justify-center items-center">
          <img src={image4} alt="" className='md:max-w-[470px]' />
          <div className="text w-10/12 flex-col flex gap-3 md:max-w-[450px]">
            <h2 className='text-[24px] md:text-[40px] font-bold'>
              What are the <span className='text-[#B47AEA]'> Vidyamedic </span>  do?
            </h2>
            <p className='text-sm md:text-[16px]'>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
            </p>
          </div>

        </div>

        {/* What we do to your data? */}
        <div className="flex md:flex-row flex-col gap-4 md:gap-8 md:justify-center items-center">
          <div className="text w-10/12 flex-col flex gap-3 md:max-w-[450px]">
            <h2 className='text-[24px] md:text-[40px] font-bold'>
              What we do to your data?
            </h2>
            <p className='text-sm md:text-[16px]'>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
            </p>
          </div>

          <img src={image5} alt="" className='md:max-w-[470px]' />

        </div>

        {/*  How we build?  */}

        <div className="flex md:flex-row flex-col gap-4 md:gap-8 md:justify-center items-center">
          <img src={image6} alt="" className='md:max-w-[470px]' />
          <div className="text w-10/12 flex-col flex gap-3 md:max-w-[450px]">
            <h2 className='text-[24px] md:text-[40px] font-bold'>
              How we build?
            </h2>
            <p className='text-sm md:text-[16px]'>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
            </p>
          </div>
        </div>

      </div>

      {/* What are vidyamedic do?, What we do to your data?, How we build? END */}


      {/* Join with us now */}
      <div className="flex md:w-6/12 mx-auto justify-center items-center text-center flex-col gap-4 pb-8 px-4">
        <img src={image7} height="315" width="275" alt="" />
        <h1 className='font-bold text-[28px] md:text-[60px]'>
          <span className='text-[#B76DFD]'>Join </span>
          With Us Now!
        </h1>
        <p className='md:font-medium'>Lorem ipsum dolor sit amet consectetur, adipisicing elit. Adipisci odit aut ipsa, culpa nihil fugit fugiat quas enim. Vitae corporis obcaecati veniam sed incidunt nulla.</p>

        <button onClick={() => navigate('/sign-up')} className='rounded-md w-fit text-[#FFFFFF] hover:shadow-xl duration-200 font-semibold bg-[#B47AEA] px-6 py-2'>Lets Start!</button>
      </div>

      {/* Join with us now END */}

    </section>
  )
}
