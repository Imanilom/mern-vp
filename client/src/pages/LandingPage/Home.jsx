import React from 'react'
import Hero1 from './../../assets/images/hero.jpg';

import image1 from './../../assets/images/doctor1.png';
import image2 from './../../assets/images/doctor2.png';
import image3 from './../../assets/images/doctor3.png';
import image4 from './../../assets/images/doctor4.png';


export default function Home() {
  return (
    <section className='flex flex-col gap-24'>
      {/* Hero 1 Explain Smart Future e-healt */}


      {/* <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="py-12 md:py-20">
  
            <div className="mx-auto max-w-4xl pb-10 text-center md:pb-16">
              
                <h1 className="leading-tighter font-heading mb-6 text-5xl font-bold tracking-tighter md:text-6xl">
                  Smart Future e-Health, for who?
                </h1>

              <div className="mx-auto max-w-3xl">
                <p className="mb-6 text-xl font-normal text-gray-600 dark:text-slate-400 text-justify"></p>
              </div>
            </div>
  
           <div className="flex-flow flex">
            <div className="flex mx-auto max-w-2xl pb-10 text-center md:pb-16">
              <div className="relative m-auto max-w-2xl">
                <img src={Hero1} alt="" className="mx-auto h-full w-full rounded-md bg-gray-400 dark:bg-slate-700" />   
              </div>
            </div> 
          <div className="flex mx-auto max-w-2xl pb-10 text-center md:pb-16">
              <div className="mx-auto max-w-3xl">
                  <p className="mb-6 text-xl font-normal text-gray-600 dark:text-slate-400 text-justify">Age     : 50</p>
                  <p className="mb-6 text-xl font-normal text-gray-600 dark:text-slate-400 text-justify">Gender  : Female</p>
                  <p className="mb-6 text-xl font-normal text-gray-600 dark:text-slate-400 text-justify">Illness : Cancer</p>
                  <p className="mb-6 text-xl font-bold text-gray-600 dark:text-slate-400 text-justify">Can Be Cured?</p>
              </div>
            </div>
  
          </div>
          <div className="mx-auto max-w-4xl pb-10 text-center md:pb-16">
                <h5 className="leading-tighter font-heading mb-1 text-1xl font-bold tracking-tighter md:text-2xl">
                  Only 3 probability classification for this women:
                </h5>
            </div>
              <div className="flex-flow flex pb-10 md:pb-16">
  
                  <div className="flex mr-2 flex-col justify-between">
                      <h6 className="text-xl font-bold">Terminally ill </h6>
                      <p className="text-gray-600 dark:text-slate-400">Chance to spend the last days of their life in the comgoty of their home with familiar surroundings instead of at a hospital</p>
                  </div>
                  <div className="flex mr-2 flex-col justify-between">
                      <h6 className="text-xl font-bold">Chronically ill</h6>
                      <p className="text-gray-600 dark:text-slate-400">those with chronic conditions such as diabetes mellitus, cancer, hypertension, chronic obstructive pulmonary disease, and others require long-term care and regular monitoring of their vital parameters</p>
                  </div>
                  <div className="flex mr-2 flex-col justify-between">
                      <h6 className="text-xl font-bold">Memory impaired</h6>
                      <p className="text-gray-600 dark:text-slate-400">Patients with memory loss may otherwise be healthy enough to continue living independently</p>
                  </div>
              </div>
              
              <div className="mx-auto max-w-4xl pb-10 text-center md:pb-16">
                <h5 className="leading-tighter font-heading mb-1 mt-2 text-1xl font-bold tracking-tighter md:text-2xl">
                  What should the woman do to face her health for the rest of her life?
                </h5>
              </div>
  
          </div>
        </div> */}

      <div className="w-10/12 mx-auto py-16 flex flex-col md:justify-between md:flex-row gap-8 items-center">
        <div className="flex flex-col gap-4  md:w-5/12">
          <h1 className='text-[28px] md:text-[40px] font-bold'>
            Smart Future <span className='text-[#B47AEA]'>eHealth</span> ,
            <br />for who? </h1>

          <p className="text-[14px]">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,</p>

          <button className='rounded-md w-fit text-white font-semibold bg-[#B47AEA] px-3 py-1'>Guide me now</button>
        </div>

        <div>
          <img src={image1} alt="" />
        </div>

      </div>
      {/* End of explain */}


      {/* Traditional vs Smart Health for Individual Care */}
      <div className="w-10/12 mx-auto flex flex-col gap-12 md:gap-16">

        {/* text */}
        <div className="text-[28px] md:text-[40px] text-center font-bold flex flex-col gap-4 mb-8">
          <h1>Traditional vs <span className='text-[#B47AEA]'>Smart Health</span>  for Individual Care</h1>
          <p className='text-[16px]'>Lets compare them</p>
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
          <p className='font-semibold text-[14px] md:text-[16px] md:mt-4 text-center md:px-24 lg:px-44'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, magna aliqua. Ut enim ad minim veniam,</p>

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
          <p className='font-semibold text-[14px] md:text-[16px] md:mt-4 text-center md:px-24 lg:px-44'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, magna aliqua. Ut enim ad minim veniam,</p>

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
            <div className="text-[14px]">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor 
            </div>
          </card>

          <card className="max-w-[305px] lg:min-w-[375px]  pt-6 lg:pt-16  rounded-lg border border-[#B47AEA] flex-col gap-3 flex group px-4 py-8 hover:shadow-xl hover:translate-y-[-12px] hover:bg-[#B47AEA]/10 hover:border-[#B47AEA]/20 duration-500">

            {/* icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path className='fill-[#474444] group-hover:fill-[#B47AEA]' fill="" d="M20.13 4.155a5 5 0 0 0-4.39-1.07A6 6 0 0 0 12 5.665a6 6 0 0 0-3.72-2.58a5.09 5.09 0 0 0-4.4 1c-1.58 1.38-2.45 4.44-1.46 7.54c.112.342.246.676.4 1c.04.075.077.152.11.23c2.57 5.24 8.51 8 8.77 8.13a.672.672 0 0 0 .31.07a.702.702 0 0 0 .31-.07c.25-.11 6.25-2.85 8.8-8.15l.08-.17c.158-.34.295-.691.41-1.05c.94-3 .08-6.06-1.48-7.46m-.31 7.93c-.14.314-.3.618-.48.91h-3.31a1 1 0 0 1-.83-.45l-1.05-1.56l-2.23 4.46a1 1 0 0 1-.73.54h-.16a1 1 0 0 1-.71-.3l-2.71-2.7H4.7a10.595 10.595 0 0 1-.5-1a6.336 6.336 0 0 1-.38-1h4.21a.999.999 0 0 1 .71.29l2 2l2.38-4.76a1 1 0 0 1 .84-.55a1 1 0 0 1 .89.44l1.7 2.56h3.7a6.572 6.572 0 0 1-.43 1.12" /></svg>

            {/* title */}
            <h4 className="text-[18px] font-bold">Lorem ipsum dolor sit amet, consectetur adipiscing</h4>

            {/* text description */}
            <div className="text-[14px]">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor 
            </div>
          </card>

          <card className="max-w-[305px] lg:min-w-[375px]  pt-6 lg:pt-16  rounded-lg border border-[#B47AEA] flex-col gap-3 flex group px-4 py-8  hover:shadow-xl hover:translate-y-[-12px] hover:bg-[#B47AEA]/10 hover:border-[#B47AEA]/20 duration-500">

            {/* icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path className='fill-[#474444] group-hover:fill-[#B47AEA]' fill="" d="M20.13 4.155a5 5 0 0 0-4.39-1.07A6 6 0 0 0 12 5.665a6 6 0 0 0-3.72-2.58a5.09 5.09 0 0 0-4.4 1c-1.58 1.38-2.45 4.44-1.46 7.54c.112.342.246.676.4 1c.04.075.077.152.11.23c2.57 5.24 8.51 8 8.77 8.13a.672.672 0 0 0 .31.07a.702.702 0 0 0 .31-.07c.25-.11 6.25-2.85 8.8-8.15l.08-.17c.158-.34.295-.691.41-1.05c.94-3 .08-6.06-1.48-7.46m-.31 7.93c-.14.314-.3.618-.48.91h-3.31a1 1 0 0 1-.83-.45l-1.05-1.56l-2.23 4.46a1 1 0 0 1-.73.54h-.16a1 1 0 0 1-.71-.3l-2.71-2.7H4.7a10.595 10.595 0 0 1-.5-1a6.336 6.336 0 0 1-.38-1h4.21a.999.999 0 0 1 .71.29l2 2l2.38-4.76a1 1 0 0 1 .84-.55a1 1 0 0 1 .89.44l1.7 2.56h3.7a6.572 6.572 0 0 1-.43 1.12" /></svg>

            {/* title */}
            <h4 className="text-[18px] font-bold">Lorem ipsum dolor sit amet, consectetur adipiscing</h4>

            {/* text description */}
            <div className="text-[14px]">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor 
            </div>
          </card>

          <card className="max-w-[305px] lg:min-w-[375px] pt-6 lg:pt-16 rounded-lg border border-[#B47AEA] flex-col gap-3 flex group px-4 py-8  hover:shadow-xl hover:translate-y-[-12px] hover:bg-[#B47AEA]/10 hover:border-[#B47AEA]/20 duration-500">

            {/* icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path className='fill-[#474444] group-hover:fill-[#B47AEA]' fill="" d="M20.13 4.155a5 5 0 0 0-4.39-1.07A6 6 0 0 0 12 5.665a6 6 0 0 0-3.72-2.58a5.09 5.09 0 0 0-4.4 1c-1.58 1.38-2.45 4.44-1.46 7.54c.112.342.246.676.4 1c.04.075.077.152.11.23c2.57 5.24 8.51 8 8.77 8.13a.672.672 0 0 0 .31.07a.702.702 0 0 0 .31-.07c.25-.11 6.25-2.85 8.8-8.15l.08-.17c.158-.34.295-.691.41-1.05c.94-3 .08-6.06-1.48-7.46m-.31 7.93c-.14.314-.3.618-.48.91h-3.31a1 1 0 0 1-.83-.45l-1.05-1.56l-2.23 4.46a1 1 0 0 1-.73.54h-.16a1 1 0 0 1-.71-.3l-2.71-2.7H4.7a10.595 10.595 0 0 1-.5-1a6.336 6.336 0 0 1-.38-1h4.21a.999.999 0 0 1 .71.29l2 2l2.38-4.76a1 1 0 0 1 .84-.55a1 1 0 0 1 .89.44l1.7 2.56h3.7a6.572 6.572 0 0 1-.43 1.12" /></svg>

            {/* title */}
            <h4 className="text-[18px] font-bold">Lorem ipsum dolor sit amet, consectetur adipiscing</h4>

            {/* text description */}
            <div className="text-[14px]">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor 
            </div>
          </card>

        </div>
      </div>
      {/* What are the Smart eHealth tasks to do? END */}


      {/* <div className="justify-center items-center px-4 py-16 lg:px-8 lg:py-20">
          
          <div className="mb-0 grid grid-cols-3 gap-6 sm:grid-cols-2 md:my-12 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          
              <div className="col-span-3 pb-6 sm:col-span-1 md:col-span-1 lg:col-span-1 xl:col-span-1">
                <div className="flex-flow flex">
                  <div className="mb-4 mr-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-900"> */}
      {/* Icon */}
      {/* </div>
                  </div>
                  <div className="flex flex-col justify-between">
                      <h3 className="mb-3 text-xl font-bold">Support Center</h3>
                      <p className="text-gray-600 dark:text-slate-400">Looking for something in particular?</p>
                  </div>
                  <div className="mb-4 mr-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-900"> */}
      {/* Icon */}
      {/* </div>
                  </div>
                  <div className="flex flex-col justify-between">
                      <h3 className="mb-3 text-xl font-bold">Have a question?</h3>
                      <p className="text-gray-600 dark:text-slate-400">See our frequently asked questions</p>
                  </div>
                  <div className="mb-4 mr-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-900"> */}
      {/* Icon */}
      {/* </div>
                  </div>
                  <div className="flex flex-col justify-between">
                      <h3 className="mb-3 text-xl font-bold">Chat with us</h3>
                      <p className="text-gray-600 dark:text-slate-400">Live chat with our support team</p>
                  </div>
                </div>
              </div>
          </div>
        </div> */}
      {/* End of Feature */}

      {/* Content data Traditional vs Smart Health system */}


      {/* <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-1 pb-16 md:pb-20 py-16 md:py-20'>
        <div className="mx-auto max-w-7xl">
          <div className='md:flex md:flex-row-reverse md:gap-16'>
            <div className="self-center md:basis-1/2">
              <div className="mb-12 text-lg text-gray-600 dark:text-slate-400 text-justify">
                <div className="space-y-8">
                  <div className="flex-shrink-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-900 text-gray-50"> */}
      {/* Icon */}
      {/* </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 text-justify">Traditional Health System</h3>
                    <p className="mt-2 text-gray-600 dark:text-slate-400 text-justify"></p>
                  </div>
                </div>
              </div>
            </div>
            <div aria-hidden="true" className="mt-10 md:mt-0 md:basis-1/2">

              <div className="relative m-auto max-w-4xl">
                <img src="" alt="" className="mx-auto w-full rounded-lg bg-gray-500 shadow-lg" />
              </div>

            </div>
          </div>
        </div>
      </div> */}
      {/* End of content data  */}

      {/* Traditiional System */}

      {/* end of traditional system */}

      {/* Smart health System */}

      {/* end of smart health system */}

      {/* Faqs */}
      {/* <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <p Classname="text-3xl sm:text-4xl"></p>
        <div className="max-w-screen-xl sm:mx-auto">
          <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2 lg:gap-x-16">
            <div className="space-y-8">

              <h3 className="mb-4 text-xl font-bold"> */}
      {/* <IconArrowDownRight
                        name="tabler:arrow-down-right"
                        className="inline-block h-7 w-7 text-primary-800"
                      /> */}
      {/* title */}
      {/* </h3>
              <div className="text-gray-700 dark:text-gray-400 text-justify">desc</div>

            </div>
          </div>
        </div>
      </div> */}

      {/* end of Faqs */}

      {/* Contact */}

      {/* end of contact */}
    </section>
  )
}
