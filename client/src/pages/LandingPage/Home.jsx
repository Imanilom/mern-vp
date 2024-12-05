import React, { useEffect } from 'react'

import image8 from './../../assets/images/jam1.png';
import image4 from './../../assets/images/doctor4.png';

import { useNavigate } from 'react-router-dom';

import AOS from 'aos';

export default function Home() {
  const navigate = useNavigate();

  const customerFeedback = [
    {
      name: "John Doe",
      rating: 5,
      comment: "I love the sleek design and the battery life is incredible! It's perfect for tracking my workouts.",
      date: "2024-09-20"
    },
    {
      name: "Jane Smith",
      rating: 4,
      comment: "The health monitoring features are fantastic! Especially the heart rate and sleep tracking. Highly recommend!",
      date: "2024-09-18"
    },
    {
      name: "Michael Brown",
      rating: 5,
      comment: "The waterproof feature is amazing. I can wear it while swimming without any worries. Best smartwatch I’ve owned.",
      date: "2024-09-15"
    },
    {
      name: "Emily Davis",
      rating: 4,
      comment: "Really impressed with the notifications and call features. It helps me stay connected even when I’m away from my phone.",
      date: "2024-09-12"
    },
    {
      name: "Chris Johnson",
      rating: 5,
      comment: "Amazing value for the price. The display is crystal clear, and I love how customizable it is. Great purchase!",
      date: "2024-09-10"
    },
    {
      name: "Sophia Martinez",
      rating: 4,
      comment: "The fitness tracking is spot on! I’ve been using it for running and cycling, and it keeps me motivated. Great job!",
      date: "2024-09-08"
    }
  ];

  useEffect(() => {
    AOS.init({
      duration : 1000
    })
  }, []);


  return (
    <section className='flex flex-col gap-24 bg-[#101010]'>
      {/* Hero 1 Explain Smart Future e-healt */}

      <div className="md:w-10/12 relative text-white/95 mx-auto pb-16 flex md:justify-between md:flex-row flex-col-reverse gap-8 items-start md:min-h-[90vh] lg:min-h-[90vh]">
        <div data-aos="fade-up" className="px-8 md:px-0 flex flex-col mt-8 gap-4  md:w-8/12 lg:w-5/12">
          <p className=''>
            Sebuah alat modern untuk memantau aktivitas kesehatan, serta kebugaran anda secara otomatis.
            <br /> Dengan Perangkat Pintar
          </p>

          <p className='text-[20px] blue font-bold'>Only RP.2.300.000</p>


          <ul className='text-sm' style={{ listStyle: 'inside' }}>
            <li>Waterproof</li>
            <li>Monitoring Kesehatan </li>
            <li>Notifikasi Pintar</li>
            <li>GPS Terintegrasi</li>
            <li>Pelacakan Aktivitas</li>
            <li>Pelacakan Aktivitas</li>
          </ul>

        </div>

        <div className='relative ' data-aos="fade-up">
          <img src={image8} className='sm:w-[80%] relative z-[3]' alt="" />
          <div className="rectangle w-[200px] h-[200px] sm:w-[175px] sm:h-[175px] lg:w-[250px] z-[1] lg:h-[250px] absolute start-1/3 top-1/4 sm:start-1/4 sm:top-1/3"></div>
        </div>

        <div data-aos="fade-right" className="px-8 md:px-0 absolute sm:start-0 top-1/2 left-0 sm:bottom-0 z-[4] font-bold">
          <div className='text-[32px]'>SMART <span className='blue'>DEVICE</span></div>
          <div className='md:text-[84px] lg:text-[140px]'>
            VIDYAMEDIC
          </div>
        </div>

      </div>

      {/* End of explain */}


      {/* Traditional vs Smart Health for Individual Care */}
      <div className="w-10/12 mx-auto flex flex-col gap-12 md:gap-4">
        {/* text */}

        <div className="flex flex-col" data-aos="zoom-in">
          <p className="text-[32px] font-bold text-white mb-3">
            Tradisional Health
          </p>
          <div className="lg:w-7/12 md:w-9/12 flex items-start gap-3 mb-3">
            <div className='ps-6 py-3 pe-10 text-white bg-white/10 rounded-[10px]'>
              Traditional Health approaches rely on routine check-ups and generalized treatment plans, often based on limited data collected during doctor visits. While effective in some cases, this method can be reactive, treating issues after they arise rather than preventing them.
            </div>
            <div className="hidden sm:block w-fit text-[120px] text-white">
              &
            </div>
          </div>
          <div className="flex flex-col" data-aos="zoom-in-up">
            <p className="text-[32px] font-bold text-white mb-3">
              Smart eHealth
            </p>
            <div className="lg:w-7/12 md:w-9/12 md:flex items-start gap-3 mb-3">
              <div className='ps-6 py-3 pe-10 text-white bg-white/10 rounded-[10px]'>
                Smart Health harnesses advanced technology like wearables and real-time monitoring to give individuals full control of their health. With continuous updates on key metrics like heart rate, activity, and sleep, it enables early detection and prevention of health issues. No more relying solely on doctor visits—Smart Health puts personalized, proactive care in your hands every day.
              </div>
              <div className="md:w-1/12 text-[32px] font-semibold text-[#B76DFD]">
                Im Better than him
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Traditional vs Smart Health for Individual Care END */}


      {/* What are the Smart eHealth tasks to do? */}
      <div className="md:w-10/12 mx-auto flex flex-col sm:flex-row relative justify-between gap-12 text-white">
        <div className='flex flex-col gap-6 md:w-7/12 px-4 md:px-0' data-aos="zoom-in">

          <div className="w rectangle w-[150px] md:w-[450px] lg:w-[400px] h-[280px] absolute z-[2] lg:end-1/3 lg:bottom-1/4 md:end-1/2 end-0 bottom-0 md:top-1/2"></div>
          {/* text */}
          <h2 className='font-bold text-[32px] md:text-[40px]'>What are the Smart eHealth tasks to do?</h2>

          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>

          <ul className='text-sm flex flex-col gap-4 mt-3' style={{ listStyle: 'inside' }}>
            <li>Lorem ipsum dolor sit, amet consectetur adipisicing elit. Asperiores, quae excepturi distinctio unde inventore repellat.</li>
            <li>Lorem ipsum dolor, sit amet consectetur adipisicing elit. Vero pariatur itaque, voluptatibus fugiat repellat animi nemo alias similique quam distinctio. </li>
            <li>Lorem ipsum dolor sit amet consectetur adipisicing elit. Maxime laborum perspiciatis perferendis!</li>
            <li>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ea, eveniet doloremque magnam earum voluptates inventore dolor odio voluptatibus voluptas esse architecto similique iste minus amet?</li>

          </ul>

        </div>


        <div data-aos="fade-up" className="flex lg:w-6/12 flex-col gap-6 justify-center items-center md:flex-row  md:flex-wrap">
          <img src={image8} className='relative z-[4] md:z-[1] lg:w-[60%]' alt="" />

        </div>
      </div>
      {/* What are the Smart eHealth tasks to do? END */}


      {/* What are vidyamedic do?, What we do to your data?, How we build? */}
      <div data-aos="fade-up" className="flex-col flex gap-12 md:px-4 text-white w-10/12 mx-auto mb-16">

        {/* What are vidyamedic do? */}
        <div className="flex md:flex-row flex-col gap-4 md:gap-8 md:justify-between items-center">
          <div className='md:w-6/12'>

            <h2 className='text-[24px] md:text-[40px] font-bold'>
              What are the <span className='blue'> Vidya</span>Medic  do?
            </h2>
            <img src={image4} alt="" className='md:max-w-[470px] max-w-screen' />
          </div>
          <div className="text lg:w-10/12 flex-col flex gap-5 md:max-w-[450px]">
            <p className='text-sm md:text-[16px]'>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
            </p>
            <p className='text-sm md:text-[16px]'>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
            </p>

            <button className="px-5 py-2 bg-[#005A8F] w-fit ">
              More About Us
            </button>
          </div>

        </div>

        {/* What we do to your data? */}
        <div className="flex md:flex-row flex-col gap-4 md:gap-8 md:justify-around items-center">
          <div className="text md:w-5/12 flex-col flex gap-3 md:max-w-[450px]">
            <h2 className='text-[24px] md:text-[32px] font-bold'>
              What we do to your data?
            </h2>
            <p className='text-sm md:text-[16px]'>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
            </p>
            <p className='text-sm md:text-[16px]'>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
            </p>
          </div>

          <div className="text md:w-5/12 flex-col flex gap-3 md:max-w-[450px] pe-12">
            <h2 className='text-[24px] md:text-[40px] font-bold'>
              How we build?
            </h2>
            <p className='text-sm md:text-[16px]'>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, Lorem ipsum dolor sit.
            </p>
          </div>

        </div>

      </div>

      {/* What are vidyamedic do?, What we do to your data?, How we build? END */}

      <div data-aos="fade-up" data-aos-duration="500" className="flex-col flex gap-12 md:px-4 text-white w-screen md:w-10/12 mx-auto mb-16">

        <div className="text-center text-[32px] font-bold text-white">
          OUR HAPPY CLIENT
        </div>
        <div class="relative overflow-hidden">
          <div  class="flex  space-x-4 p-4 animate-scroll items-start">
            {customerFeedback.length > 0 ? (
              customerFeedback.map((feedback) => {
                return (
                  <div className="py-6 px-4 max-w-[250px] min-w-[250px] rounded-[10px] md:max-w-[350px] md:min-w-[250px] bg-[#292929] text-white">
                    {feedback.comment}
                  </div>
                )
              })
            ) : null}

            {customerFeedback.length > 0 ? (
              customerFeedback.map((feedback) => {
                return (
                  <div className="py-6 px-4 max-w-[250px] min-w-[250px] rounded-[10px] md:max-w-[350px] md:min-w-[250px] bg-[#292929] text-white">
                    {feedback.comment}
                  </div>
                )
              })
            ) : null}
          </div>
        </div>



      </div>
    </section>
  )
}
