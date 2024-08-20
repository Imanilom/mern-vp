import React from 'react';
import project1 from '../../../src/assets/images/project1.png';
import project2 from '../../../src/assets/images/project2.png';

import '../../App.css';
import { useState } from 'react';

function Project() {
  const [toggInfo, setToggInfo] = useState(false);

  return (
    <>
      <div className='flex flex-col gap-8'>
        <section className='text-slate-800 pb-8 pt-16 px-4 md:font-medium md:w-10/12 lg:w-7/12 lg:mx-24'>
          <h2 className='text-[20px] md:text-[28px] lg:text-[40px] mb-3 font-bold'>Hey👋, welcome in our project</h2>
          <p className='md:text-[18px] lg:text-[24px]'>
            Are you looking for a way to improve your health and well-being? If so, you might be interested in joining our project<span className='text-[#B76DFD] font-semibold'> “Activity Tracking”.
            </span>
          </p>
        </section>

        <section className='' style={{ overflowX: 'auto' }}>
          <div className="flex gap-3 scrool-behavior-animate">
            <img src={project1} className="w-[360px] duration-200 hover:translate-y-[-12px] h-[385px]" alt="Project 1" />
            <img src={project2} className="w-[360px] duration-200 hover:translate-y-[-12px] h-[385px]" alt="Project 2" />
            <img src={project1} className="w-[360px] duration-200 hover:translate-y-[-12px] h-[385px]" alt="Project 1" />
            <img src={project2} className="w-[360px] duration-200 hover:translate-y-[-12px] h-[385px]" alt="Project 2" />
            <img src={project1} className="w-[360px] duration-200 hover:translate-y-[-12px] h-[385px]" alt="Project 1" />
            <img src={project2} className="w-[360px] duration-200 hover:translate-y-[-12px] h-[385px]" alt="Project 2" />
          </div>
        </section>

        <div className="flex items-center px-4 lg:px-0">
          <div className="content lg:mx-24 md:w-10/12 lg:w-7/12 flex flex-col gap-12">
            <div>
              <h1 className='text-[20px] md:text-[28px] font-bold mb-4'>
                What is <span className='text-[#B76DFD]'>Activity Tracking?</span>
              </h1>
              <p>
                Activity Tracking is a project that aims to develop and test a smart wearable sensor system that can monitor your physical activity, sleep quality, stress level, and other health indicators. By using this system, you can get personalized insights and recommendations on how to improve your lifestyle and prevent or manage chronic diseases.
                <br /><br />
                As a participant of this project, you will receive a free rent smart watch or band that will collect and transmit your health data to our secure cloud platform. You will also have access to a mobile app or web dashboard that will show you your progress and provide you with tips and challenges. You will also be able to share your data and experiences with other participants and researchers, creating a supportive and engaging community.
              </p>
            </div>

            <div>
              <h1 className='text-[20px] md:text-[28px] font-bold mb-4'>
                What the <span className='text-[#B76DFD]'>Benefit join</span> with us?
              </h1>
              <p>
                By joining this project, you will not only benefit from the latest technology and scientific knowledge, but also contribute to the advancement of health research and innovation. You will help us understand how IoT-assisted wearable sensor systems can improve health outcomes and quality of life for people around the world.
                <br /><br />

                {toggInfo ? (
                  <div>

                    If you are interested in joining this project, please fill out this online form or contact us at [email protected] We are looking for people who are 18 years or older, have a smartphone or computer with internet access, and are willing to wear the sensor device and use the app or dashboard for at least 3 months.
                    <br /><br />
                    Don’t miss this opportunity to be part of a cutting-edge project that can make a difference in your health and well-being. Join Activity Tracking today and start your journey towards a healthier and happier life!
                  </div>
                ) : null}
              </p>

              <button onClick={() => setToggInfo(!toggInfo)} className='rounded-md mt-4 w-fit text-white font-semibold bg-[#B47AEA] px-6 py-2'>
                {toggInfo ? `Less Information` : `More Information`}
              </button>
            </div>

          </div>

          <div className="w-fit hidden lg:flex flex-col gap-16 font-bold">
            <div className="sec-1 text-[40px]">
              ACTIVITY <br />
              TRACK <br />
              ING <br />
            </div>

            <div className="sec-2 text-[40px]">
              ACT <br />
              IFITY <br />
              TRACKING
            </div>
          </div>
        </div>

        <div className="lg:mx-24 md:w-10/12 lg:w-7/12 px-4 lg:px-0">
          <h1 className='text-[20px] md:text-[28px] font-bold mb-4'>
            Features available in our project
          </h1>
          <p>
            The Heart Disease Decision Support Monitoring, Detection, and Predictive System is a comprehensive system designed to assist healthcare professionals in monitoring, detecting, and predicting heart disease.
            <br /> <br />
            It utilizes various data sources, analysis techniques, and predictive models to provide valuable insights and support informed decision-making. Here are the key components and functionalities of such a system:
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div className="collection-card py-8 flex gap-4 items-center ms-4 lg:mx-24">

            <card className='max-h-[370px] max-w-[311px] min-w-[311px] border-black px-4 pt-12 pb-4 border rounded-lg flex flex-col gap-2 hover:translate-y-[-20px] hover:shadow-xl duration-500 group'>
              {/* icon */}

              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path className='fill-black group-hover:fill-[#B76DFD]' fill="" d="M21 16v3c0 1.657-4.03 3-9 3s-9-1.343-9-3v-3c0 1.657 4.03 3 9 3s9-1.343 9-3m-9-1c-4.97 0-9-1.343-9-3v3c0 1.657 4.03 3 9 3s9-1.343 9-3v-3c0 1.657-4.03 3-9 3m0-13C7.03 2 3 3.343 3 5v2c0 1.657 4.03 3 9 3s9-1.343 9-3V5c0-1.657-4.03-3-9-3m0 9c-4.97 0-9-1.343-9-3v3c0 1.657 4.03 3 9 3s9-1.343 9-3V8c0 1.657-4.03 3-9 3" /></svg>

              {/* title */}
              <h3 className='text-[20px] font-bold'>
                Data Collection
              </h3>

              {/* text */}

              <p>
                The system gathers relevant data from multiple sources, including patient medical records, diagnostic tests (e.g., electrocardiograms, stress tests), lifestyle information, and risk factor data (e.g., age, gender, blood pressure, cholesterol levels).
              </p>
            </card>

            <card className='max-h-[370px] max-w-[311px] min-w-[311px] border-black px-4 pt-12 pb-4 border rounded-lg flex flex-col gap-2 hover:translate-y-[-20px] hover:shadow-xl duration-500 group'>

              {/* icon */}

              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path fill="" className='fill-black group-hover:fill-[#B76DFD]' d="M8.625 8.5h-4.5a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v3.5h3.5a1 1 0 0 1 0 2" /><path className='fill-black group-hover:fill-[#B76DFD]' fill="" d="M21 13a1 1 0 0 1-1-1A7.995 7.995 0 0 0 5.08 8.001a1 1 0 0 1-1.731-1.002A9.995 9.995 0 0 1 22 12a1 1 0 0 1-1 1m-1.125 9a1 1 0 0 1-1-1v-3.5h-3.5a1 1 0 0 1 0-2h4.5a1 1 0 0 1 1 1V21a1 1 0 0 1-1 1" /><path className='fill-black group-hover:fill-[#B76DFD]' fill="\" d="M12 22A10.012 10.012 0 0 1 2 12a1 1 0 0 1 2 0a7.995 7.995 0 0 0 14.92 3.999a1 1 0 0 1 1.731 1.002A10.032 10.032 0 0 1 12 22" /></svg>

              {/* title */}
              <h3 className='text-[20px] font-bold'>
                Data Collection
              </h3>

              {/* text */}

              <p>
                The system gathers relevant data from multiple sources, including patient medical records, diagnostic tests (e.g., electrocardiograms, stress tests), lifestyle information, and risk factor data (e.g., age, gender, blood pressure, cholesterol levels).
              </p>
            </card>

            <card className='max-h-[370px] max-w-[311px] min-w-[311px] border-black px-4 pt-12 pb-4 border rounded-lg flex flex-col gap-2 hover:translate-y-[-20px] hover:shadow-xl duration-500 group'>

              {/* icon */}

              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><g fill="none"><path d="M24 0v24H0V0zM12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z" /><path className='fill-black group-hover:fill-[#B76DFD]' fill="black" d="m13.299 3.148l8.634 14.954a1.5 1.5 0 0 1-1.299 2.25H3.366a1.5 1.5 0 0 1-1.299-2.25l8.634-14.954c.577-1 2.02-1 2.598 0M12 15a1 1 0 1 0 0 2a1 1 0 0 0 0-2m0-7a1 1 0 0 0-.993.883L11 9v4a1 1 0 0 0 1.993.117L13 13V9a1 1 0 0 0-1-1" /></g></svg>

              {/* title */}
              <h3 className='text-[20px] font-bold'>
                Risk Assessment
              </h3>

              {/* text */}

              <p>
                The system employs risk assessment models to evaluate a patient's risk of developing heart disease. These models consider various risk factors and use statistical methods to calculate the probability or risk score associated with heart disease.
              </p>
            </card>

            <card className='max-h-[370px] max-w-[311px] min-w-[311px] border-black px-4 pt-12 pb-4 border rounded-lg flex flex-col gap-2 hover:translate-y-[-20px] hover:shadow-xl duration-500 group'>

              {/* icon */}

              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32"><path fill="" className='fill-black group-hover:fill-[#B76DFD]' d="M30 12V4h-8v3h-4a2 2 0 0 0-2 2v6h-6v-3H2v8h8v-3h6v6a2 2 0 0 0 2 2h4v3h8v-8h-8v3h-4V9h4v3ZM8 18H4v-4h4Zm16 4h4v4h-4Zm0-16h4v4h-4Z" /></svg>

              {/* title */}
              <h3 className='text-[20px] font-bold'>
                Decision Support
              </h3>

              {/* text */}

              <p>
                The system provides decision support tools to assist healthcare professionals in making informed decisions. It may include interactive dashboards, visualizations, and reports that present patient data, risk assessment results, and relevant guidelines for treatment or prevention.

              </p>
            </card>

            <card className='max-h-[370px] max-w-[311px] min-w-[311px] border-black px-4 pt-12 pb-4 border rounded-lg flex flex-col gap-2 hover:translate-y-[-20px] hover:shadow-xl duration-500 group'>

              {/* icon */}

              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path fill="" className='fill-black group-hover:fill-[#B76DFD]' d="M11 18h2v3h-2zm5 3v2H8v-2zm4-3H4a3.003 3.003 0 0 1-3-3V4a3.003 3.003 0 0 1 3-3h16a3.003 3.003 0 0 1 3 3v11a3.003 3.003 0 0 1-3 3M4 3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1Z" /><path fill="black" className='fill-black group-hover:fill-slate-800' d="m16 15l-1.914-6.38L13 13l-1.309-3h-.331L10 14L8.843 9.933L8.309 11H5v-1h2.691L9 7l1.068 3.713L10.64 9h1.669l.487.973L14 4l2 8l.64-2H19v1h-1.64z" /></svg>

              {/* title */}
              <h3 className='text-[20px] font-bold'>
                Monitoring and Alerting
              </h3>

              {/* text */}

              <p>
                The system continuously monitors patient data and provides real-time alerts or notifications to healthcare professionals if there are any significant changes or indications of heart disease progression. This allows for timely intervention and proactive management.
              </p>
            </card>

            <card className='max-h-[370px] max-w-[311px] min-w-[311px] border-black px-4 pt-12 pb-4 border rounded-lg flex flex-col gap-2 hover:translate-y-[-20px] hover:shadow-xl duration-500 group'>

              {/* icon */}

              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path fill="" className='fill-black group-hover:fill-[#B76DFD]' d="M17.416 2.624a.75.75 0 1 0-.832-1.248L13.669 3.32A4.488 4.488 0 0 0 12 3c-.59 0-1.153.113-1.669.32L7.416 1.376a.75.75 0 0 0-.832 1.248l2.36 1.573a4.493 4.493 0 0 0-1.368 2.475A5.447 5.447 0 0 1 8.938 6.5h6.125c.47 0 .926.06 1.361.172a4.493 4.493 0 0 0-1.368-2.475zM1.25 14a.75.75 0 0 1 .75-.75h3v-1.312c0-.836.26-1.611.704-2.248l-2.483-.994a.75.75 0 0 1 .558-1.392l3.136 1.254A3.92 3.92 0 0 1 8.938 8h6.124c.74 0 1.432.204 2.023.558l3.136-1.254a.75.75 0 1 1 .558 1.392l-2.483.994A3.92 3.92 0 0 1 19 11.938v1.312h3a.75.75 0 0 1 0 1.5h-3V15a6.97 6.97 0 0 1-.808 3.269l2.587 1.035a.75.75 0 0 1-.558 1.393l-2.892-1.158a6.987 6.987 0 0 1-4.579 2.421V15a.75.75 0 1 0-1.5 0v6.96a6.988 6.988 0 0 1-4.579-2.42L3.78 20.696a.75.75 0 1 1-.558-1.393l2.588-1.035A6.97 6.97 0 0 1 5 15v-.25H2a.75.75 0 0 1-.75-.75" /></svg>

              {/* title */}
              <h3 className='text-[20px] font-bold'>
                Detection of Anomalies
              </h3>

              {/* text */}

              <p>
                Advanced analytics techniques, such as anomaly detection algorithms, can be applied to identify abnormal patterns or outliers in patient data that may indicate potential heart disease or related complications.
              </p>
            </card>


            <card className='max-h-[370px] max-w-[311px] min-w-[311px] border-black px-4 pt-12 pb-4 border rounded-lg flex flex-col gap-2 hover:translate-y-[-20px] hover:shadow-xl duration-500 group'>

              {/* icon */}

              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 2048 2048"><path fill="" className='fill-black group-hover:fill-[#B76DFD]' d="M2048 896h-896V384H512v256h384v896H512v256h640v-640h896v896h-896v-128H384v-384H0V640h384V256h768V0h896zm-768-768v128h640V128zm0 256v384h640V384zm0 896v128h640v-128zm0 256v384h640v-384zm-512-128v-384H128v384zm0-640H128v128h640z" /></svg>

              {/* title */}
              <h3 className='text-[20px] font-bold'>
                Predictive Modeling
              </h3>

              {/* text */}

              <p>
                The system employs predictive modeling techniques, such as machine learning algorithms, to forecast the likelihood of heart disease occurrence or progression for individual patients. These models use historical data to learn patterns and make predictions about future outcomes.

              </p>
            </card>


            <card className='max-h-[370px] max-w-[311px] min-w-[311px] border-black px-4 pt-12 pb-4 border rounded-lg flex flex-col gap-2 hover:translate-y-[-20px] hover:shadow-xl duration-500 group'>

              {/* icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 20 20"><path fill="" className='fill-black group-hover:fill-[#B76DFD]' d="M6.819 17.259q.111.408.335.74h-.156c-1.104 0-2-.895-2.001-2l-.005-5.535zM4 16.499q0 .228.04.446l-.056-.015a2 2 0 0 1-1.416-2.45l1.426-5.34zm3.655.018a2 2 0 0 0 2.451 1.414l5.416-1.451a2 2 0 0 0 1.413-2.45L14.099 3.482a2 2 0 0 0-2.451-1.413l-5.416 1.45a2 2 0 0 0-1.413 2.449zM9 6.25a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0" /></svg>

              {/* title */}
              <h3 className='text-[20px] font-bold'>
                Integration with Clinical Guidelines
              </h3>

              {/* text */}

              <p>
                The system integrates evidence-based guidelines and best practices for heart disease management and prevention. This ensures that healthcare professionals have access to up-to-date recommendations and can align their decisions with established standards of care.
              </p>
            </card>


            <card className='max-h-[370px] max-w-[311px] min-w-[311px] border-black px-4 pt-12 pb-4 border rounded-lg flex flex-col gap-2 hover:translate-y-[-20px] hover:shadow-xl duration-500 group'>

              {/* icon */}

              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32"><path fill="" className='fill-black group-hover:fill-[#B76DFD]' d="M3.625 25.062a1 1 0 0 1-.77-1.187L6.51 6.585l2.267 9.258l1.923-5.188l3.58 3.74l3.884-13.102l2.934 11.734l1.96-1.51l5.27 11.74a1 1 0 1 1-1.826.817l-4.23-9.428l-2.374 1.826l-1.896-7.596l-2.783 9.393l-3.755-3.924l-3.08 8.314l-1.73-7.083l-1.843 8.71a1 1 0 0 1-1.187.775z" /></svg>

              {/* title */}
              <h3 className='text-[20px] font-bold'>
                Continuous Improvement
              </h3>

              {/* text */}

              <p>
                The system leverages feedback from healthcare professionals, data analysis, and clinical outcomes to continuously improve its algorithms, models, and decision support capabilities.

              </p>
            </card>
          </div>

        </div>

        <div className="lg:mx-24 md:w-10/12 lg:w-7/12 px-4 lg:px-0 pb-8">
          <p>This iterative process enhances the accuracy and effectiveness of the system over time.The Heart Disease Decision Support Monitoring, Detection, and Predictive System aims to enhance clinical decision-making, improve patient outcomes, and optimize the management of heart disease by providing valuable insights and support to healthcare professionals.Futher information please email: <a style={{textDecoration : `underline`}} className='text-[#B76DFD] font-semibold' href="" target="_blank" rel="noopener noreferrer"> vidya@pptik.itb.ac.id
          </a>
          </p>
        </div>
      </div>
    </>
  );
}

export default Project;
