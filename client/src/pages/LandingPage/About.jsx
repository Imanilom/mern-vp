import React from "react";
import Logo_PPTIk from "./../../assets/images/Logo PPTIK.png";

function About() {
  return (
    <div className="w-full relative bg-white overflow-hidden flex flex-col items-start justify-start pt-8 px-4 pb-64 gap-36 leading-normal tracking-normal sm:gap-9 md:gap-18 md:px-7">
      <section className="w-full flex flex-col sm:flex-row items-start justify-center text-left text-6xl text-black font-inter">
        <div className="w-full max-w-3xl flex flex-col items-start justify-start gap-12 sm:gap-5 md:gap-10">
          <div className="w-full flex flex-col sm:flex-row items-center md:items-end justify-start gap-8 sm:gap-4 md:flex-wrap">
            <img
              className="h-30 w-30 object-cover md:flex-1"
              loading="lazy"
              alt=""
              src={Logo_PPTIk}
            />
            <div className="flex-1 flex flex-col items-start justify-start pb-4 min-w-[283px] ">
              <div className="w-full flex flex-col items-start justify-start gap-3">
                <div className="flex flex-row items-start justify-start">
                  <h3 className="text-2xl font-semibold">PPTIK - ITB</h3>
                </div>
                <div className="w-full text-base leading-tight text-justify">
                  PPTIK merupakan salah satu pusat penelitian yang terdapat di
                  ITB yang dibangun dengan tujuan agar masyarakat dapat
                  memanfaatkan penyebaran TIK yang secara global telah meluas.
                </div>
              </div>
            </div>
          </div>
          <div className="w-full max-w-2xl flex flex-col items-center md:items-start justify-start gap-5 text-justify">
            <h3 className="m-0 text-2xl font-semibold ">OUR VISION</h3>
            <div className="w-full text-base leading-tight">
              Every Indonesian citizen must be able to take advantage of ICT for
              the advancement of his life. Every citizen can participate in the
              knowledge society and the knowledge economy, either benefiting
              from it or participating in building it. In 2016 every Indonesian
              citizen should be able to get rations for free Building a
              world-class reputation for research and researchers. This requires
              topic alignment, researcher competence, facility feasibility, high
              activity and the rise of global partnerships in the field of ICT
              research. Encouraging the development of commercial,
              entrepreneurship and industrial products in the ICT field. This is
              also indicated by the significant contribution of the ICT sector
              to ITB revenue. Research Center for Information and Communication
              Technology (PPTIK) Head of PP : Dr. Ary Setijadi Prihatmanto, ST.,
              MT. Address : 4th Floor, Gd. Litbang Integrasi dan Aplikasi (PAU)
            </div>
          </div>
          {/* <textarea
            className="border-none bg-gray-300 h-80 w-full outline-none p-4 font-inter font-medium text-sm text-black"
            placeholder="Ini gmaps"
            rows={7}
            cols={8}
          /> */}

          <div class="mapouter relative text-end w-[100%] h-[390px]">
            <div class="gmap_canvas overflow-hidden bg-none w-[100%] h-[390px]">
              <iframe width="520" height="400" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" id="gmap_canvas" src="https://maps.google.com/maps?width=520&amp;height=400&amp;hl=en&amp;q=Jl.%20Ganesa%20No.10,%20Lb.%20Siliwangi,%20Kecamatan%20Coblong,%20Kota%20Bandung,%20Jawa%20Barat%2040132,%20Indonesia%20Bandung+(Institut%20Teknologi%20Bandung)&amp;t=&amp;z=15&amp;ie=UTF8&amp;iwloc=B&amp;output=embed"></iframe> <a href='https://mapswebsite.org/de'>maps einbinden</a> <script type='text/javascript' src='https://embedmaps.com/google-maps-authorization/script.js?id=87de3d80cad254f311c3a744a0b68d898dfa04f3'></script>
              <a href="https://embed-googlemap.com">embed-googlemap.com</a>
            </div>
          </div>

          <div className="w-full text-base font-semibold">
            <h5>Jl. Tamansari No. 126, Bandung 40132, Indonesia</h5>
            <h5>Phone: +62-22-4254034 / 0811 2298 086</h5>
            <h5>Fax: +62-22-2508763</h5>
            Email : yuliawati.pptik@gmail.com
          </div>
        </div>
      </section>
    </div>
  );
}

export default About;
