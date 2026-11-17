import { useState, useMemo, useEffect } from 'react';
import { Course } from '../types';

export function useSearch(courses: Course[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLevel, setSelectedLevel] = useState('All');
  
  const prices = useMemo(() => {
    return courses.map(c => c.price);
  }, [courses]);

  const absoluteMinPrice = useMemo(() => {
    return prices.length ? Math.min(...prices) : 0;
  }, [prices]);

  const absoluteMaxPrice = useMemo(() => {
    return prices.length ? Math.max(...prices) : 10000;
  }, [prices]);

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(10000);

  // Sync state defaults when courses list loads or updates
  useEffect(() => {
    if (courses.length) {
      setMinPrice(absoluteMinPrice);
      setMaxPrice(absoluteMaxPrice);
    }
  }, [courses, absoluteMinPrice, absoluteMaxPrice]);

  const categories = useMemo(() => {
    const list = new Set(courses.map(c => c.category).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [courses]);

  const levels = useMemo(() => {
    return ['All', 'Beginner', 'Intermediate', 'Advanced'];
  }, []);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedLevel('All');
    setMinPrice(absoluteMinPrice);
    setMaxPrice(absoluteMaxPrice);
  };

  const globalSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return courses.filter((course) => {
      const matchTitle = course.title ? course.title.toLowerCase().includes(query) : false;
      const matchDesc = course.description ? course.description.toLowerCase().includes(query) : false;
      return matchTitle || matchDesc;
    });
  }, [courses, searchQuery]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = course.title ? course.title.toLowerCase().includes(query) : false;
        const matchDesc = course.description ? course.description.toLowerCase().includes(query) : false;
        if (!matchTitle && !matchDesc) return false;
      }

      // 2. Category
      if (selectedCategory && selectedCategory !== 'All') {
        if (course.category !== selectedCategory) return false;
      }

      // 3. Level/Skill Level
      if (selectedLevel && selectedLevel !== 'All') {
        if (course.level !== selectedLevel) return false;
      }

      // 4. Price Range
      if (course.price < minPrice || course.price > maxPrice) return false;

      return true;
    });
  }, [courses, searchQuery, selectedCategory, selectedLevel, minPrice, maxPrice]);

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedLevel,
    setSelectedLevel,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    absoluteMinPrice,
    absoluteMaxPrice,
    categories,
    levels,
    resetFilters,
    globalSearchResults,
    filteredCourses,
  };
}

