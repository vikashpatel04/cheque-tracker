/**
 * The Excel and PDF libraries are a large part of the app and few visits need
 * them, so they load the first time they're used (plan item 69).
 */
export const loadXlsx = () => import('xlsx')

export async function loadPdf() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { jsPDF, autoTable }
}
