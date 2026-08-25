import React from 'react';

export default function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize }) {
  if (totalPages <= 1 && totalItems <= pageSize) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: '1px solid var(--line)', background: '#FAFBFC' }}>
      <span style={{ fontSize: 11, color: 'var(--gray)' }}>
        Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalItems)} dari {totalItems} baris
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button 
          className="btn-outline-navy" 
          style={{ fontSize: 11, padding: '4px 10px' }}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 8px', color: 'var(--navy)' }}>
          {currentPage} / {totalPages}
        </span>
        <button 
          className="btn-outline-navy" 
          style={{ fontSize: 11, padding: '4px 10px' }}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
