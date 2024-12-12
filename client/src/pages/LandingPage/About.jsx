import React, { useEffect } from "react";
import Logo_PPTIk from "./../../assets/images/Logo_PPTIK-removebg-cropped.png";
import AOS  from "aos";

function About() {
  useEffect(() => {
    AOS.init({
      duration: 1000
    })
  }, [])

  return (
    <div className=" relative bg-[#101010] dark:bg-[#FEFCF5] md:py-16 overflow-hidden flex flex-col gap-16">
      <div data-aos="zoom-in" data-aos-duration="500" className="w-10/12 mx-auto relative my-8">

        <div className="rectangle w-[230px] dark:hidden block h-32 absolute top-0 start-1/4"></div>
        <div className="rectangle-white-theme dark:block hidden w-[230px] h-32 absolute top-0 z-[-1] start-1/4"></div>

        <div className="rectangle w-[300px] dark:hidden block h-32 absolute bottom-0 end-0"></div>
        <div className="rectangle-white-theme dark:block hidden w-[300px] h-32 absolute bottom-0 end-0"></div>

        <div className="rectangle dark:hidden block"></div>
        <div className="rectangle-white-theme hidden dark:block"></div>
        <div className="flex md:flex-row flex-col justify-center gap-16  text-white dark:text-[#073B4C]">
          <div className="flex lg:flex-row flex-col gap-6">

            <img src={Logo_PPTIk} alt="" className="lg:w-full w-[60%]" />
            <div className="max-w-[300px] flex flex-col gap-4">
              <p className="text-[32px] font-semibold">PPTIK - ITB</p>
              <p>Pusat Penelitian Teknologi Informasi dan Komunikasi</p>
              <hr />
              <p>Institut Teknologi Bandung</p>
            </div>
          </div>
          <div className="md:w-4/12">
            <p>PPTIK merupakan salah satu pusat penelitian yang terdapat di ITB yang dibangun dengan tujuan agar masyarakat dapat memanfaatkan penyebaran TIK yang secara global telah meluas.</p>
          </div>
        </div>
      </div>

      <div data-aos="fade-left" className="w-10/12 mx-auto  my-8  text-white dark:text-[#073B4C]">
        <div className="max-w-3xl relative">

          <div className="rectangle w-full h-full absolute blur-[30px] bg-white/5 block dark:hidden"></div>
          <div className="rectangle-white-theme w-full h-full absolute blur-[20px] hidden dark:block"></div>
          <h1 className="text-[32px] font-bold">
            Our Vision
          </h1>
          <p className="">Every Indonesian citizen must be able to take advantage of ICT for the advancement of his life. Every citizen can participate in the knowledge society and the knowledge economy, either benefiting from it or participating in building it. In 2016 every Indonesian citizen should be able to get rations for free Building a world-class reputation for research and researchers. This requires topic alignment, researcher competence, facility feasibility, high activity and the rise of global partnerships in the field of ICT research. Encouraging the development of commercial, entrepreneurship and industrial products in the ICT field. This is also indicated by the significant contribution of the ICT sector to ITB revenue. Research Center for Information and Communication Technology (PPTIK) Head of PP : Dr. Ary Setijadi Prihatmanto, ST., MT. Address : 4th Floor, Gd. Litbang Integrasi dan Aplikasi (PAU)</p>
        </div>
      </div>

      <div className="w-11/12 md:w-10/12 mx-auto  my-8  text-white dark:text-[#073B4C]">
        <div className="text-center text-[32px] font-bold mb-6">
          Our Gallery
        </div>

        <div className="flex md:flex-row flex-col gap-4 my-2" data-aos="zoom-in" >
          <div className="md:w-5/12 h-[280px] lg:h-[370px] bg-[#363636] dark:bg-[#E5E5E5]"></div>
          <div className="md:w-7/12 h-[280px] lg:h-[370px] bg-[#363636] dark:bg-[#E5E5E5]"></div>
        </div>

        <div className="w-full my-4 h-[340px] lg:h-[370px] bg-[#363636] dark:bg-[#E5E5E5]" data-aos="zoom-in" ></div>

        <div className="flex md:flex-row flex-col gap-4 my-2" data-aos="zoom-out-right" data-aos-duration="700" >
          <div className="md:w-5/12">
            <div className="w-full h-[280px] lg:h-[370px] bg-[#363636] dark:bg-[#E5E5E5]"></div>
            <div className="font-bold text-[32px] mt-2 text-white dark:text-[#217170]">
              PPTIK BANDUNG
            </div>
          </div>
          <div className="md:w-7/12 h-[380px] lg:h-[470px] bg-[#363636] dark:bg-[#E5E5E5]"></div>
        </div>
      </div>

      <div data-aos="zoom-in" data-aos-duration="400" className="w-full md:w-10/12 mx-auto items-center md:flex-row flex-col gap-6 flex justify-between my-8  text-white dark:text-[#073B4C]">

        <div className="w-full text-base font-semibold px-4 md:px-0">
          <div className="font-bold text-[32px] my-5 text-white dark:text-[#217170]">
            OUR LOCATION
          </div>
          <h5>Jl. Tamansari No. 126, Bandung 40132, Indonesia</h5>
          <h5>Phone: +62-22-4254034 / 0811 2298 086</h5>
          <h5>Fax: +62-22-2508763</h5>
          Email : yuliawati.pptik@gmail.com
        </div>

        <div class="mapouter relative text-end md:w-[100%] lg:w-[100%] w-full h-[480px]">
          <div class="gmap_canvas overflow-hidden bg-none md:w-[100%] lg:w-[100%] h-[480px]">
            <iframe className="lg:w-[620px] md:w-[400px] lg:h-[480px] md:h-[360px] w-full h-[300px]" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" id="gmap_canvas" src="https://maps.google.com/maps?width=520&amp;height=400&amp;hl=en&amp;q=Jl.%20Ganesa%20No.10,%20Lb.%20Siliwangi,%20Kecamatan%20Coblong,%20Kota%20Bandung,%20Jawa%20Barat%2040132,%20Indonesia%20Bandung+(Institut%20Teknologi%20Bandung)&amp;t=&amp;z=15&amp;ie=UTF8&amp;iwloc=B&amp;output=embed"></iframe> <a href='https://mapswebsite.org/de'></a> <script type='text/javascript' src='https://embedmaps.com/google-maps-authorization/script.js?id=87de3d80cad254f311c3a744a0b68d898dfa04f3'></script>

          </div>
        </div>


      </div>
    </div>
  );
}

export default About;
