import React, { useEffect } from 'react';
import project1 from '../../../src/assets/images/project1.png';
import project2 from '../../../src/assets/images/project2.png';

import jam1 from '../../../src/assets/images/jam1.png';
import jam2 from '../../../src/assets/images/jam2.png';
import jam3 from '../../../src/assets/images/jam3.jpg';

import { IoMail } from "react-icons/io5";

import '../../App.css';
import { useState } from 'react';
import AOS from 'aos';

function Project() {
  useEffect(() => {
    AOS.init({
      duration : 700
    })
  }, []);
  return (
    <div className="bg-[#101010] dark:bg-[#FEFCF5]">
      <div className='flex flex-col justify-center items-center min-h-[90vh] relative gap-8'>

        {/* image jam */}
        <div className="absolute end-0 top-0 md:z-[2] md:w-[40%] lg:w-fit" data-aos="fade-up">
          <img src={jam1} alt="" />
        </div>
        <div className="absolute start-0 lg:end-0 top-0 z-[2] hidden lg:block" data-aos="fade-up">
          <img src={jam2} alt="" />
        </div>

        {/* box */}
        <div className="rectangle dark:hidden absolute w-36 h-36 top-1/3 end-1/3 hidden lg:block"></div>
        <div className="rectangle-white-theme dark:lg:block absolute w-36 h-36 top-1/3 end-1/3 hidden lg:hidden"></div>

        <div className="rectangle absolute dark:hidden w-60 h-60 top-1/3 end-[5%] hidden md:block"></div>
        <div className="rectangle-white-theme dark:md:block absolute w-60 h-60 top-1/3 end-[5%] hidden md:hidden"></div>

        <div className="rectangle z-[1] absolute dark:hidden block w-screen md:w-36 h-[240px] bottom-2/4 end-1/2 md:start-1/4"></div>
        <div className="rectangle-white-theme dark:block hidden z-[1] absolute w-screen md:w-36 h-[240px] bottom-2/4 end-1/2 md:start-1/4"></div>

        <div className="rectangle absolute dark:hidden w-[300px] h-36 bottom-[5%] z-[3] start-1/4 hidden lg:block"></div>

        <div className="rectangle-white-theme dark:block absolute w-[300px] h-36 bottom-[5%] z-[3] dark:z-[1] start-1/4 hidden lg:hidden"></div>

        <div data-aos="fade-up" data-aos-duration="1500" className="lg:w-7/12 flex-col flex gap-4 font-bold text-center text-white dark:text-[#073B4C]">
          <p className='md:text-[32px] hidden md:block '>Welcome To Our Project</p>
          <p className='text-[64px] lg:text-[90px] lg:z-1 z-[5] text-white dark:text-[#FFD166]'>SMART <span className='text-[#005A8F] dark:text-[#217170]'>DEVICE</span></p>
          <p className='font-medium md:font-bold md:text-normal w-[90%] md:w-[70%] mx-auto lg:z-1 z-[5]'>
            Are you looking for a way to improve your health and well-being? If so, you might be interested in joining our project
            <span className='text-[#005A8F] dark:text-[#217170]'> Activity Tracking.
            </span>
          </p>

        </div>
      </div>

      <div data-aos="fade-up" className='flex flex-col md:flex-row justify-center items-center py-8 relative gap-8 text-white dark:text-[#073B4C]'>
        <div className="w-10/12 md:w-4/12">
          <p className='text-[32px] font-bold mb-3'>
            What is <span className='text-[#005A8F] dark:text-[#217170]'>Activity Tracking </span>
          </p>
          <p>
            Activity Tracking is a project that aims to develop and test a smart wearable sensor system that can monitor your physical activity, sleep quality, stress level, and other health indicators. By using this system, you can get personalized insights and recommendations on how to improve your lifestyle and prevent or manage chronic diseases.
          </p>
        </div>
        <div className="w-10/12 md:w-4/12">
          As a participant of this project, you will receive a free rent smart watch or band that will collect and transmit your health data to our secure cloud platform. You will also have access to a mobile app or web dashboard that will show you your progress and provide you with tips and challenges. You will also be able to share your data and experiences with other participants and researchers, creating a supportive and engaging community.</div>
      </div>


      <div data-aos="fade-up" className='flex lg:flex-row flex-col mt-8 justify-between w-9/12 mx-auto items-center py-8 relative gap-8 text-white dark:text-[#073B4C]'>
        <div className="lg:w-5/12">
          <p className='text-[32px] font-bold mb-3'>
            What benefit join with us
          </p>
          <p>
            By joining this project, you will not only benefit from the latest technology and scientific knowledge, but also contribute to the advancement of health research and innovation. You will help us understand how IoT-assisted wearable sensor systems can improve health outcomes and quality of life for people around the world.
            <br /><br />
            If you are interested in joining this project, please fill out this online form or contact us at <a href="" className='text-[#005A8F] font-semibold dark:text-[#217170] underline'>vidya@pptik.itb.ac.id</a> We are looking for people who are 18 years or older, have a smartphone or computer with internet access, and are willing to wear the sensor device and use the app or dashboard for at least 3 months.
          </p>
          <p>
            <button className='px-6 py-3 bg-[#005A8F] text-white dark:bg-[#217170] rounded-[2px]font-bold flex gap-2 mt-4'>
              <span>
                <IoMail size={24} color="white" />
              </span>
              <span>

                Contact Us
              </span>
            </button>
          </p>
        </div>

        <div className="lg:w-5/12 relative">
          <div className="absolute dark:hidden block lg:top-[-5%] lg:start-[-5%] start-[5%] top-[5%] rectangle w-[90%] h-full"></div>
          <div className="absolute rectangle-white-theme lg:top-[-5%] lg:start-[-5%] start-[5%] top-[5%]  w-[90%] h-full hidden dark:block"></div>
          <img src={jam3} className='w-[90%]' alt="" />
        </div>
      </div>

      <div data-aos="zoom-in" data-aos-duration="700" className='flex flex-col lg:flex-row mt-8 justify-between w-9/12 mx-auto lg:items-center py-8 relative gap-8 text-white dark:text-[#073B4C]'>
        <div className="lg:w-5/12 relative">
          <div className="w rectangle w-[200px] md:w-96 absolute top-0 start-0 h-16">

          </div>

          <p  className='text-[32px] text-start font-bold mb-3 text-white dark:text-[#217170]'>
            Features available in our project
          </p>
        </div>

        <div className="lg:w-5/12 relative">
          <p>
            The Heart Disease Decision Support Monitoring, Detection, and Predictive System is a comprehensive system designed to assist healthcare professionals in monitoring, detecting, and predicting heart disease.
            <br /> <br />
            It utilizes various data sources, analysis techniques, and predictive models to provide valuable insights and support informed decision-making. Here are the key components and functionalities of such a system:
          </p>
        </div>
      </div>


      <div className='md:w-9/12 mx-auto py-8 relative gap-8 text-white'>
        <div class="overflow-x-auto w-screen p-4">
          <div class="flex space-x-4 justify-center md:justify-start">
            {/* <!-- Card 1 --> */}
            <div style={{ backgroundImage: `url('${jam3}')` }} class=" hover:shadow-[0px_2px_2px_2px_rgba(255,255,255,0.05)] flex-none group w-28 h-96 bg-cover bg-center rounded-full hover:rounded-[5px] hover:w-[300px] transition-[width,height] duration-500 ease-in-out relative">
              <div className="absolute top-0 start-0 w-full rounded-full group-hover:rounded-[5px] h-full bg-[#131313]/80 group-hover:bg-[#131313]/60" />
              <div class="absolute inset-0 flex items-end justify-center text-white font-bold opacity-0 hover:opacity-100 transition-opacity duration-[400] ease-in-out ">
                <div class="p-0 group-hover:p-6 md:p-6">
                  <h3 class="text-[24px]">Data Collection</h3>
                  <p className='font-normal text-sm'>The system gathers relevant data from multiple sources, including patient medical records, diagnostic tests (e.g., electrocardiograms, stress tests), lifestyle information, and risk factor data (e.g., age, gender, blood pressure, cholesterol levels).</p>
                </div>
              </div>
            </div>

            <div style={{ backgroundImage: `url('${jam3}')` }} class=" hover:shadow-[0px_2px_2px_2px_rgba(255,255,255,0.05)] flex-none group w-28 h-96 bg-cover bg-center rounded-full hover:rounded-[5px] hover:w-[300px] transition-[width,height] duration-500 ease-in-out relative">
              <div className="absolute top-0 start-0 w-full rounded-full group-hover:rounded-[5px] h-full bg-[#131313]/80 group-hover:bg-[#131313]/60" />
              <div class="absolute inset-0 flex items-end justify-center text-white font-bold opacity-0 hover:opacity-100 transition-opacity duration-[400] ease-in-out ">
                <div class="p-0 group-hover:p-6 md:p-6">
                  <h3 class="text-[24px]">Risk Assessment</h3>
                  <p className='font-normal text-sm'>The system employs risk assessment models to evaluate a patient's risk of developing heart disease. These models consider various risk factors and use statistical methods to calculate the probability or risk score associated with heart disease..</p>
                </div>
              </div>
            </div>

            <div style={{ backgroundImage: `url('${jam3}')` }} class=" hover:shadow-[0px_2px_2px_2px_rgba(255,255,255,0.05)] flex-none group w-28 h-96 bg-cover bg-center rounded-full hover:rounded-[5px] hover:w-[300px] transition-[width,height] duration-500 ease-in-out relative">
              <div className="absolute top-0 start-0 w-full rounded-full group-hover:rounded-[5px] h-full bg-[#131313]/80 group-hover:bg-[#131313]/60" />
              <div class="absolute inset-0 flex items-end justify-center text-white font-bold opacity-0 hover:opacity-100 transition-opacity duration-[400] ease-in-out ">
                <div class="p-0 group-hover:p-6 md:p-6">
                  <h3 class="text-[24px]"> Decision Support</h3>
                  <p className='font-normal text-sm'> The system provides decision support tools to assist healthcare professionals in making informed decisions. It may include interactive dashboards, visualizations, and reports that present patient data, risk assessment results, and relevant guidelines for treatment or prevention.</p>
                </div>
              </div>
            </div>

            <div style={{ backgroundImage: `url('${jam3}')` }} class=" hover:shadow-[0px_2px_2px_2px_rgba(255,255,255,0.05)] flex-none group w-28 h-96 bg-cover bg-center rounded-full hover:rounded-[5px] hover:w-[300px] transition-[width,height] duration-500 ease-in-out relative">
              <div className="absolute top-0 start-0 w-full rounded-full group-hover:rounded-[5px] h-full bg-[#131313]/80 group-hover:bg-[#131313]/60" />
              <div class="absolute inset-0 flex items-end justify-center text-white font-bold opacity-0 hover:opacity-100 transition-opacity duration-[400] ease-in-out ">
                <div class="p-0 group-hover:p-6 md:p-6">
                  <h3 class="text-[24px]">Monitoring and Alerting</h3>
                  <p className='font-normal text-sm'>  The system continuously monitors patient data and provides real-time alerts or notifications to healthcare professionals if there are any significant changes or indications of heart disease progression. This allows for timely intervention and proactive management.</p>
                </div>
              </div>
            </div>

            <div style={{ backgroundImage: `url('${jam3}')` }} class=" hover:shadow-[0px_2px_2px_2px_rgba(255,255,255,0.05)] flex-none group w-28 h-96 bg-cover bg-center rounded-full hover:rounded-[5px] hover:w-[300px] transition-[width,height] duration-500 ease-in-out relative">
              <div className="absolute top-0 start-0 w-full rounded-full group-hover:rounded-[5px] h-full bg-[#131313]/80 group-hover:bg-[#131313]/60" />
              <div class="absolute inset-0 flex items-end justify-center text-white font-bold opacity-0 hover:opacity-100 transition-opacity duration-[400] ease-in-out ">
                <div class="p-0 group-hover:p-6 md:p-6">
                  <h3 class="text-[24px]"> Detection of Anomalies</h3>
                  <p className='font-normal text-sm'>Advanced analytics techniques, such as anomaly detection algorithms, can be applied to identify abnormal patterns or outliers in patient data that may indicate potential heart disease or related complications.</p>
                </div>
              </div>
            </div>

            <div style={{ backgroundImage: `url('${jam3}')` }} class=" hover:shadow-[0px_2px_2px_2px_rgba(255,255,255,0.05)] flex-none group w-28 h-96 bg-cover bg-center rounded-full hover:rounded-[5px] hover:w-[300px] transition-[width,height] duration-500 ease-in-out relative">
              <div className="absolute top-0 start-0 w-full rounded-full group-hover:rounded-[5px] h-full bg-[#131313]/80 group-hover:bg-[#131313]/60" />
              <div class="absolute inset-0 flex items-end justify-center text-white font-bold opacity-0 hover:opacity-100 transition-opacity duration-[400] ease-in-out ">
                <div class="p-0 group-hover:p-6 md:p-6">
                  <h3 class="text-[24px]">Predictive Modeling</h3>
                  <p className='font-normal text-sm'> The system employs predictive modeling techniques, such as machine learning algorithms, to forecast the likelihood of heart disease occurrence or progression for individual patients. These models use historical data to learn patterns and make predictions about future outcomes.</p>
                </div>
              </div>
            </div>

            <div style={{ backgroundImage: `url('${jam3}')` }} class=" hover:shadow-[0px_2px_2px_2px_rgba(255,255,255,0.05)] flex-none group w-28 h-96 bg-cover bg-center rounded-full hover:rounded-[5px] hover:w-[300px] transition-[width,height] duration-500 ease-in-out relative">
              <div className="absolute top-0 start-0 w-full rounded-full group-hover:rounded-[5px] h-full bg-[#131313]/80 group-hover:bg-[#131313]/60" />
              <div class="absolute inset-0 flex items-end justify-center text-white font-bold opacity-0 hover:opacity-100 transition-opacity duration-[400] ease-in-out ">
                <div class="p-0 group-hover:p-6 md:p-6">
                  <h3 class="text-[24px]">Integration with Clinical Guidelines</h3>
                  <p className='font-normal text-sm'>The system integrates evidence-based guidelines and best practices for heart disease management and prevention. This ensures that healthcare professionals have access to up-to-date recommendations and can align their decisions with established standards of care.</p>
                </div>
              </div>
            </div>

            <div style={{ backgroundImage: `url('${jam3}')` }} class=" hover:shadow-[0px_2px_2px_2px_rgba(255,255,255,0.05)] flex-none group w-28 h-96 bg-cover bg-center rounded-full hover:rounded-[5px] hover:w-[300px] transition-[width,height] duration-500 ease-in-out relative">
              <div className="absolute top-0 start-0 w-full rounded-full group-hover:rounded-[5px] h-full bg-[#131313]/80 group-hover:bg-[#131313]/60" />
              <div class="absolute inset-0 flex items-end justify-center text-white font-bold opacity-0 hover:opacity-100 transition-opacity duration-[400] ease-in-out ">
                <div class="p-0 group-hover:p-6 md:p-6">
                  <h3 class="text-[24px]">Continuous Improvement</h3>
                  <p className='font-normal text-sm'>The system leverages feedback from healthcare professionals, data analysis, and clinical outcomes to continuously improve its algorithms, models, and decision support capabilities.</p>
                </div>
              </div>
            </div>

            {/* <!-- Tambah Card lainnya jika perlu --> */}
          </div>
        </div>

      </div>

      <div className='md:w-9/12 w-11/12 mx-auto py-8 relative gap-8 text-white dark:text-[#073B4C]'>
        <p className='lg:w-1/2'>This iterative process enhances the accuracy and effectiveness of the system over time.The Heart Disease Decision Support Monitoring, Detection, and Predictive System aims to enhance clinical decision-making, improve patient outcomes, and optimize the management of heart disease by providing valuable insights and support to healthcare professionals.Futher information please email: <a className='text-[#005A8F] underline dark:text-[#217170] font-semibold' href="">vidya@pptik.itb.ac.id</a></p>
      </div>


    </div>
  );
}

export default Project;
