import { Course, CourseModule, Lesson, Coupon, SystemSettings } from './types';

export const INITIAL_SETTINGS: SystemSettings = {
  gstRate: 18,
  systemName: "SkillFort LMS",
  supportEmail: "support@skillfort.com",
  razorpayKeyId: "",
  themeColor: "#F89A15",
  smtpEnabled: false,
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  mailFrom: "",
  adminNotifyEmail: "",
};

export const INITIAL_COUPONS: Coupon[] = [
  {
    id: "coupon-1",
    code: "FORT30",
    discountPercent: 30,
    isActive: true,
    minAmount: 1000,
    expiryDate: "2027-12-31"
  },
  {
    id: "coupon-2",
    code: "FIRST50",
    discountPercent: 50,
    isActive: true,
    minAmount: 1999,
    expiryDate: "2027-06-30"
  },
  {
    id: "coupon-3",
    code: "WELCOME10",
    discountPercent: 10,
    isActive: true,
    minAmount: 499,
    expiryDate: "2027-12-31"
  }
];

export const INITIAL_COURSES: Course[] = [
  {
    id: "course-1",
    title: "Java Full Stack Developer Certification Program",
    description: "Launch your career as a Java Full-Stack developer. Master core Java, J2EE, Spring Boot, microservice architectures, Hibernate, and modern React.js frontend structures. Learn database design with MySQL/PostgreSQL, robust JWT authorization, and Docker deployments.",
    coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=600&auto=format&fit=crop",
    price: 3999,
    duration: "45h 30m",
    level: "Beginner",
    category: "Full Stack Development",
    rating: 4.9,
    reviewsCount: 284,
    isPublished: true,
    createdAt: "2026-01-15T08:00:00Z"
  },
  {
    id: "course-2",
    title: "Data Analyst & Business Intelligence Masterclass",
    description: "Equip yourself with the tools to solve complex business problems. Master Advanced Excel, SQL Databases, Python script analysis, and build professional interactive analytics dashboards in Power BI & Tableau. Practice on real-world financial and product data.",
    coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=600&auto=format&fit=crop",
    price: 3499,
    duration: "38h 15m",
    level: "Beginner",
    category: "Data Analytics",
    rating: 4.9,
    reviewsCount: 312,
    isPublished: true,
    createdAt: "2026-02-10T09:30:00Z"
  },
  {
    id: "course-3",
    title: "Python Full Stack Training Program",
    description: "Build robust dynamic web applications using Python. Learn Python programming fundamentals, Django MVC architectural frameworks, FastAPI restful APIs, HTML5/CSS3, Tailwind CSS styling, JavaScript, and PostgreSQL storage architectures.",
    coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop",
    price: 3499,
    duration: "40h 20m",
    level: "Beginner",
    category: "Full Stack Development",
    rating: 4.8,
    reviewsCount: 195,
    isPublished: true,
    createdAt: "2026-03-01T10:15:00Z"
  },
  {
    id: "course-4",
    title: "Oracle SQL & Relational Database Training",
    description: "Deep-dive into enterprise relational databases. Master Oracle SQL writing, complex multi-table JOINs, subqueries, analytical window functions, PL/SQL trigger programming, stored procedures, indexes, and database query optimization.",
    coverImage: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=600&auto=format&fit=crop",
    price: 1999,
    duration: "22h 40m",
    level: "Intermediate",
    category: "Database Administration",
    rating: 4.7,
    reviewsCount: 122,
    isPublished: true,
    createdAt: "2026-03-10T11:00:00Z"
  },
  {
    id: "course-5",
    title: "Automation Testing Masterclass: Selenium & Cucumber",
    description: "Master automated software verification. Learn Selenium WebDriver SDK, core Java testing patterns, TestNG runner configuration, Cucumber BBD Gherkin syntax, page object designs (POM), CI/CD pipelines, and Maven project building.",
    coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=600&auto=format&fit=crop",
    price: 2499,
    duration: "28h 10m",
    level: "Intermediate",
    category: "Software Testing",
    rating: 4.8,
    reviewsCount: 167,
    isPublished: true,
    createdAt: "2026-03-15T14:20:00Z"
  },
  {
    id: "course-react",
    title: "Modern React 19 & Frontend Architecture Masterclass",
    description: "Master React 19 from the ground up. Deep-dive into Concurrent Mode, the React Compiler, custom hooks, context isolation, state-management architectures, Server Components, Server Actions, Suspense APIs, and CSS Tailwind design layouts.",
    coverImage: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=600&auto=format&fit=crop",
    price: 2999,
    duration: "20h 0m",
    level: "Intermediate",
    category: "Frontend Development",
    rating: 5.0,
    reviewsCount: 42,
    isPublished: true,
    createdAt: "2026-04-01T10:00:00Z"
  },
  {
    id: "course-react-tested",
    title: "React Tested - Enterprise Testing & Architecture",
    description: "Step-by-step masterclass on testing modern React 19 web applications. Learn component testing, integration tests, mock endpoints, and dynamic performance validation using Jest, Cypress, and modern React Testing Library.",
    coverImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop",
    price: 3200,
    duration: "15h 45m",
    level: "Advanced",
    category: "Frontend Development",
    rating: 5.0,
    reviewsCount: 15,
    isPublished: true,
    createdAt: "2026-04-10T12:00:00Z"
  }
];

export const INITIAL_MODULES: CourseModule[] = [
  // Course 1 Modules (Java)
  {
    id: "module-1-1",
    courseId: "course-1",
    title: "Java Foundations & OOP Principles",
    description: "Core JDK architecture, syntax, object-oriented concepts, exception mechanisms, and collection frameworks.",
    order: 1
  },
  {
    id: "module-1-2",
    courseId: "course-1",
    title: "Backend Services with Spring Boot & Hibernate",
    description: "Building production REST APIs, Spring Data JPA mappings, security filters, and JWT authorization.",
    order: 2
  },
  {
    id: "module-1-3",
    courseId: "course-1",
    title: "Frontend Integration with React & Deployment",
    description: "Consuming REST APIs, state handlers, building dynamic UI layouts, and containerizing with Docker.",
    order: 3
  },

  // Course 2 Modules (Data Analyst)
  {
    id: "module-2-1",
    courseId: "course-2",
    title: "Advanced Excel & Data Cleaning Systems",
    description: "Automating workflows with pivot tables, index/match lookups, Power Query pipelines, and error isolation.",
    order: 1
  },
  {
    id: "module-2-2",
    courseId: "course-2",
    title: "SQL queries & Power BI Analytics Dashboards",
    description: "Formulating PostgreSQL statements, connecting datasets in Power BI Desktop, DAX metrics, and dashboard reports.",
    order: 2
  },

  // Course 3 Modules (Python)
  {
    id: "module-3-1",
    courseId: "course-3",
    title: "Python Essentials & Django REST API foundations",
    description: "Python data structures, decorators, Django models, MVC setup, and REST API serialization.",
    order: 1
  },

  // Course 4 Modules (Oracle)
  {
    id: "module-4-1",
    courseId: "course-4",
    title: "Oracle SQL syntax & Relational schema setups",
    description: "DDL/DML instructions, normalization keys, set operators, and subquery definitions.",
    order: 1
  },

  // Course 5 Modules (Automation Testing)
  {
    id: "module-5-1",
    courseId: "course-5",
    title: "Selenium Framework Setup & BDD Gherkin integration",
    description: "WebDriver locators, wait configurations, Cucumber features, and JUnit reports.",
    order: 1
  },
  {
    id: "module-react-1",
    courseId: "course-react",
    title: "Chapter 1: Concurrent Rendering & React 19 Hooks",
    description: "Deep-dive into concurrent loops, Suspense boundary states, asset loading, Actions API, and the brand-new compiler.",
    order: 1
  },
  {
    id: "module-react-tested-1",
    courseId: "course-react-tested",
    title: "Chapter 1: Component Rendering & Unit Tests",
    description: "Explore Jest and React Testing Library setup, rendering states, and user interactions testing.",
    order: 1
  }
];

export const INITIAL_LESSONS: Lesson[] = [
  // Course 1, Module 1 Lessons
  {
    id: "lesson-1-1-1",
    moduleId: "module-1-1",
    title: "Overview of Java HotSpot Virtual Machine (JVM)",
    type: "video",
    order: 1,
    vimeoUrl: "https://vimeo.com/76979871",
    vimeoId: "76979871",
    thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=400",
    duration: "12:15"
  },
  {
    id: "lesson-1-1-2",
    moduleId: "module-1-1",
    title: "Object-Oriented Programming (OOP) Deep Dive (PDF)",
    type: "pdf",
    order: 2,
    fileUrl: "/assets/java-oop-principles.pdf",
    fileName: "java-oop-principles.pdf",
    fileSize: "3.2 MB"
  },
  {
    id: "lesson-1-1-3",
    moduleId: "module-1-1",
    title: "Multi-threading & Synchronous Queues in Java",
    type: "video",
    order: 3,
    vimeoUrl: "https://vimeo.com/112390623",
    vimeoId: "112390623",
    thumbnail: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=400",
    duration: "18:40"
  },

  // Course 1, Module 2 Lessons
  {
    id: "lesson-1-2-1",
    moduleId: "module-1-2",
    title: "Bootstrapping Spring Boot Microservices",
    type: "video",
    order: 1,
    vimeoUrl: "https://vimeo.com/861596707",
    vimeoId: "861596707",
    thumbnail: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=400",
    duration: "15:22"
  },
  {
    id: "lesson-1-2-2",
    moduleId: "module-1-2",
    title: "Database Seeding & JPA Schema Migration Script",
    type: "download",
    order: 2,
    fileUrl: "/assets/seed-java-db.sh",
    fileName: "seed-java-db.sh",
    fileSize: "15 KB"
  },
  {
    id: "lesson-1-2-3",
    moduleId: "module-1-2",
    title: "Java Full Stack Comprehensive Assessment Quiz",
    type: "quiz",
    order: 3,
    passMark: "80",
    timeLimit: "15"
  },

  // Course 2, Module 1 Lessons
  {
    id: "lesson-2-1-1",
    moduleId: "module-2-1",
    title: "Structuring Power BI Interactive Portals",
    type: "video",
    order: 1,
    vimeoUrl: "https://vimeo.com/253982121",
    vimeoId: "253982121",
    thumbnail: "https://images.unsplash.com/photo-1461151304267-38535e780c79?q=80&w=400",
    duration: "10:05"
  },

  // Course 3, Module 1 Lessons
  {
    id: "lesson-3-1-1",
    moduleId: "module-3-1",
    title: "Building Real-Time Views with Django Channels",
    type: "video",
    order: 1,
    vimeoUrl: "https://vimeo.com/375468729",
    vimeoId: "375468729",
    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400",
    duration: "22:10"
  },

  // Course 4, Module 1 Lessons
  {
    id: "lesson-4-1-1",
    moduleId: "module-4-1",
    title: "Relational Algebra & Oracle SQL Window Functions",
    type: "video",
    order: 1,
    vimeoUrl: "https://vimeo.com/861596707",
    vimeoId: "861596707",
    thumbnail: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=400",
    duration: "12:12"
  },

  // Course 5, Module 1 Lessons
  {
    id: "lesson-5-1-1",
    moduleId: "module-5-1",
    title: "Automation Locators & Explicit Dynamic Wait Rules",
    type: "video",
    order: 1,
    vimeoUrl: "https://vimeo.com/253982121",
    vimeoId: "253982121",
    thumbnail: "https://images.unsplash.com/photo-1461151304267-38535e780c79?q=80&w=400",
    duration: "14:45"
  },
  {
    id: "lesson-react-11",
    moduleId: "module-react-1",
    title: "Introduction to React 19 & The Compiler System",
    type: "video",
    order: 1,
    vimeoUrl: "https://vimeo.com/76979871",
    vimeoId: "76979871",
    thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=400",
    duration: "10:00"
  },
  {
    id: "lesson-react-12",
    moduleId: "module-react-1",
    title: "Deep Dive: Server Actions & Concurrent State APIs",
    type: "video",
    order: 2,
    vimeoUrl: "https://vimeo.com/112390623",
    vimeoId: "112390623",
    thumbnail: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=400",
    duration: "10:00"
  },
  {
    id: "lesson-react-13",
    moduleId: "module-react-1",
    title: "React 19 & Concurrent State Assessment Quiz",
    type: "quiz",
    order: 3,
    passMark: "80",
    timeLimit: "15"
  },
  {
    id: "lesson-react-tested-1",
    moduleId: "module-react-tested-1",
    title: "Setting up Jest and React Testing Library in Vite",
    type: "video",
    order: 1,
    vimeoUrl: "https://vimeo.com/76979871",
    vimeoId: "76979871",
    thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=400",
    duration: "12:10"
  },
  {
    id: "lesson-react-tested-2",
    moduleId: "module-react-tested-1",
    title: "Mocking API responses & fetch routines",
    type: "video",
    order: 2,
    vimeoUrl: "https://vimeo.com/112390623",
    vimeoId: "112390623",
    thumbnail: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=400",
    duration: "15:45"
  },
  {
    id: "lesson-react-tested-3",
    moduleId: "module-react-tested-1",
    title: "React Tested Comprehensive Assessment Quiz",
    type: "quiz",
    order: 3,
    passMark: "80",
    timeLimit: "15"
  }
];

export const INITIAL_TESTIMONIALS = [
  {
    name: "Aaditya Sharma",
    role: "Java Developer, Tata Consultancy Services",
    comment: "The Java Full Stack Program is of immense quality. It covers Enterprise Spring Boot and Microservices with hands-on labs. The coupon systems, placement mentors, and student resume checks are solid additions.",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150"
  },
  {
    name: "Archana Kamath",
    role: "Senior Business Analyst, Wipro",
    comment: "The Data Analyst & Power BI Masterclass was exceptional. The dynamic portfolio dashboards that we constructed made an immediate impact in my interview processes.",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150"
  },
  {
    name: "Rohan Advani",
    role: "Automation Engineer, Cognizant",
    comment: "Excellent platform interface. Beautiful course tracking, instant GST bill generation, and the auto-saved learning positions enabled me to resume right where I left off across multiple devices.",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150"
  }
];

export const INITIAL_FAQS = [
  {
    question: "What courses are available in your LMS?",
    answer: "We offer career-transforming, job-aligned training tracks including Data Analyst & Business Intelligence, Java Full Stack Training, Python Full Stack Training, Oracle Relational Database Training, and Automation Testing with Selenium."
  },
  {
    question: "Who can enroll in these courses?",
    answer: "Our courses are structured specifically to cater to both absolute beginners looking for career switches, as well as intermediate and advanced IT developers wishing to scale up their technological expertise."
  },
  {
    question: "Do I need prior programming knowledge?",
    answer: "No, most courses feature modular curriculum frameworks starting from absolute foundational elements (such as core logic, spreadsheets, or command setups) before introducing complex frameworks."
  },
  {
    question: "What is included in the Full Stack Development courses?",
    answer: "The packages contain interactive HD lessons, structured downloadable source scripts, real-world project portfolios, dynamic quizzes, personal resume mentoring, and lifetime certification with custom unique ID credentials."
  },
  {
    question: "What tools are covered in Automation Testing?",
    answer: "We cover complete industry standards: Selenium WebDriver, Cucumber BDD syntax, Java testing paradigms, Maven build orchestrator systems, and TestNG automation suites."
  },
  {
    question: "Will I get hands-on projects?",
    answer: "Yes, each training includes 3 to 4 enterprise projects covering production issues, API integrations, dashboard deployments, and structural debugging loops."
  }
];
