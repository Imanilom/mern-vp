    import React from 'react'
    import Hero1 from '../assets/images/hero.jpg';
    export default function Home() {
      return (
        <section>
        {/* Hero 1 Explain Smart Future e-healt */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
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
        </div>
        {/* End of explain */}

        {/* Feature */}
        
        <div className="justify-center items-center px-4 py-16 lg:px-8 lg:py-20">
          
          <div className="mb-0 grid grid-cols-3 gap-6 sm:grid-cols-2 md:my-12 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          
              <div className="col-span-3 pb-6 sm:col-span-1 md:col-span-1 lg:col-span-1 xl:col-span-1">
                <div className="flex-flow flex">
                  <div className="mb-4 mr-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-900">
                    {/* Icon */}
                    </div>
                  </div>
                  <div className="flex flex-col justify-between">
                      <h3 className="mb-3 text-xl font-bold">Support Center</h3>
                      <p className="text-gray-600 dark:text-slate-400">Looking for something in particular?</p>
                  </div>
                  <div className="mb-4 mr-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-900">
                    {/* Icon */}
                    </div>
                  </div>
                  <div className="flex flex-col justify-between">
                      <h3 className="mb-3 text-xl font-bold">Have a question?</h3>
                      <p className="text-gray-600 dark:text-slate-400">See our frequently asked questions</p>
                  </div>
                  <div className="mb-4 mr-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-900">
                    {/* Icon */}
                    </div>
                  </div>
                  <div className="flex flex-col justify-between">
                      <h3 className="mb-3 text-xl font-bold">Chat with us</h3>
                      <p className="text-gray-600 dark:text-slate-400">Live chat with our support team</p>
                  </div>
                </div>
              </div>
          </div>
        </div>
        {/* End of Feature */}

        {/* Content data Traditional vs Smart Health system */}
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-1 pb-16 md:pb-20 py-16 md:py-20'>
          <div className="mx-auto max-w-7xl">
            <div className='md:flex md:flex-row-reverse md:gap-16'>
              <div className="self-center md:basis-1/2">
               <div className="mb-12 text-lg text-gray-600 dark:text-slate-400 text-justify">
                  <div className="space-y-8">
                        <div className="flex-shrink-0">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-900 text-gray-50">
                            {/* Icon */}
                          </div>
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
      </div>
        {/* End of content data  */}

        {/* Traditiional System */}

        {/* end of traditional system */}

        {/* Smart health System */}

        {/* end of smart health system */}

        {/* Faqs */}
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"> 
          <p Classname="text-3xl sm:text-4xl"></p> 
          <div className="max-w-screen-xl sm:mx-auto">
            <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2 lg:gap-x-16">
                <div className="space-y-8">
                  
                    <h3 className="mb-4 text-xl font-bold">
                      {/* <IconArrowDownRight
                        name="tabler:arrow-down-right"
                        className="inline-block h-7 w-7 text-primary-800"
                      /> */}
                      {/* title */}
                    </h3>
                    <div className="text-gray-700 dark:text-gray-400 text-justify">desc</div>
                  
                </div>
            </div>
          </div>
        </div>
  
        {/* end of Faqs */}

        {/* Contact */}

        {/* end of contact */}
      </section>
      )
    }
    