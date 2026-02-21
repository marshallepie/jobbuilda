'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import CreateTestModal from '@/components/CreateTestModal';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

interface TimeEntry {
  id: string;
  user_id: string;
  date: string;
  start_time?: string;
  end_time?: string;
  hours: number;
  break_minutes?: number;
  description?: string;
  is_overtime?: boolean;
  notes?: string;
  technician_name?: string;
}

interface Material {
  id: string;
  name?: string;
  description?: string;
  quantity?: number;
  quantity_used?: number;
  unit: string;
  unit_price_ex_vat?: number;
  unit_cost?: number;
  total_ex_vat?: number;
  total_cost?: number;
  logged_at?: string;
  created_at?: string;
}

interface Variation {
  id: string;
  variation_number: string;
  description: string;
  status: string;
  amount_ex_vat: number;
  vat_amount: number;
  amount_inc_vat: number;
  created_at: string;
}

interface Test {
  id: string;
  test_number: string;
  test_type: string;
  title: string;
  status: string;
  outcome?: string;
  test_date?: string;
  completion_date?: string;
}

interface Job {
  id: string;
  job_number: string;
  title: string;
  description?: string;
  status: string;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  estimated_hours?: number;
  created_at: string;
  updated_at: string;
  client_id?: string;
  site_id?: string;
  quote_id?: string;
  client_name?: string;
  site_name?: string;
  site_address?: string;
  electrical_work_type?: string;
}

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params?.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerNotes, setTimerNotes] = useState('');

  // Manual time entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    start_time: '',
    end_time: '',
    notes: '',
  });

  // Material logging state
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [materialsCatalog, setMaterialsCatalog] = useState<any[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [useCustomMaterial, setUseCustomMaterial] = useState(false);
  const [materialForm, setMaterialForm] = useState({
    sku: '',
    name: '',
    description: '',
    quantity: '',
    unit: 'units',
    unit_price_ex_vat: '',
    notes: '',
  });

  useEffect(() => {
    if (jobId) {
      loadJobDetails();
    }
  }, [jobId]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning && timerStart) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - timerStart.getTime()) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timerStart]);

  const loadJobDetails = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      // Load job details
      const jobData = await api.getJob(jobId) as any;

      // Fetch client details if client_id exists
      if (jobData.client_id) {
        try {
          const clientData = await api.request(`/api/clients/clients/${jobData.client_id}`) as any;
          jobData.client_name = clientData.name;
        } catch (err) {
          console.error('Failed to load client:', err);
        }
      }

      // Fetch site details if site_id exists
      if (jobData.site_id) {
        try {
          const siteData = await api.request(`/api/clients/sites/${jobData.site_id}`) as any;
          jobData.site_name = siteData.name;
          jobData.site_address = [
            siteData.address_line1,
            siteData.address_line2,
            siteData.city,
            siteData.county,
            siteData.postcode
          ].filter(Boolean).join(', ');
        } catch (err) {
          console.error('Failed to load site:', err);
        }
      }

      setJob(jobData);

      // Extract time entries from job data (they're included in the job response)
      if (jobData.time_entries && Array.isArray(jobData.time_entries)) {
        setTimeEntries(jobData.time_entries);
      }

      // Load related data in parallel
      Promise.all([
        loadMaterials(),
        loadVariations(),
        loadTests(),
      ]);
    } catch (err) {
      console.error('Failed to load job:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      const data = await api.getJobMaterials(jobId) as any;
      // Handle different possible response structures
      let materialList = [];
      if (Array.isArray(data)) {
        materialList = data;
      } else if (data.data && data.data.materials) {
        materialList = data.data.materials;
      } else if (data.data && Array.isArray(data.data)) {
        materialList = data.data;
      } else if (data.materials) {
        materialList = data.materials;
      }
      setMaterials(materialList);
    } catch (err) {
      console.error('Failed to load materials:', err);
    }
  };

  const loadVariations = async () => {
    try {
      const data = await api.getJobVariations(jobId) as any;
      const variationList = Array.isArray(data) ? data : (data.data || []);
      setVariations(variationList);
    } catch (err) {
      console.error('Failed to load variations:', err);
    }
  };

  const loadTests = async () => {
    try {
      const data = await api.get(`/api/tests/job/${jobId}`) as any;
      const testList = Array.isArray(data) ? data : (data.data || []);
      setTests(testList);
    } catch (err) {
      console.error('Failed to load tests:', err);
    }
  };

  const loadMaterialsCatalog = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const data = await api.getMaterials() as any;
      const catalogList = Array.isArray(data) ? data : (data.data || []);
      setMaterialsCatalog(catalogList);
      setFilteredMaterials(catalogList);
    } catch (err) {
      console.error('Failed to load materials catalog:', err);
    }
  };

  const handleMaterialSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredMaterials(materialsCatalog);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = materialsCatalog.filter(
      (material) =>
        material.name?.toLowerCase().includes(lowerQuery) ||
        material.sku?.toLowerCase().includes(lowerQuery) ||
        material.description?.toLowerCase().includes(lowerQuery)
    );
    setFilteredMaterials(filtered);
  };

  const handleSelectMaterial = (material: any) => {
    setSelectedMaterial(material);
    setSearchQuery(material.name);
    setMaterialForm({
      ...materialForm,
      sku: material.sku || '',
      name: material.name || '',
      description: material.description || '',
      unit: material.unit || 'units',
      unit_price_ex_vat: material.unit_cost?.toString() || '',
    });
    setFilteredMaterials([]);
  };

  const handleStartJob = async () => {
    if (!job) return;

    if (confirm(`Start job ${job.job_number}?`)) {
      setActionLoading(true);
      try {
        await api.startJob(jobId);
        await loadJobDetails();
        alert('Job started successfully!');
      } catch (err: any) {
        console.error('Failed to start job:', err);
        alert(err.message || 'Failed to start job. Please try again.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleCompleteJob = async () => {
    if (!job) return;

    if (confirm(`Mark job ${job.job_number} as complete?`)) {
      setActionLoading(true);
      try {
        await api.completeJob(jobId);
        await loadJobDetails();
        alert('Job completed successfully!');
      } catch (err: any) {
        console.error('Failed to complete job:', err);
        alert(err.message || 'Failed to complete job. Please try again.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const calculateTotalHours = () => {
    if (!Array.isArray(timeEntries)) return 0;
    return timeEntries.reduce((sum, entry) => sum + (parseFloat(entry.hours as any) || 0), 0);
  };

  const calculateTotalMaterialsCost = () => {
    if (!Array.isArray(materials)) return 0;
    return materials.reduce((sum, material) => {
      const total = parseFloat(material.total_cost?.toString() || material.total_ex_vat?.toString() || '0');
      return sum + total;
    }, 0);
  };

  const calculateTotalVariationsCost = () => {
    if (!Array.isArray(variations)) return 0;
    return variations.reduce((sum, variation) => sum + variation.amount_inc_vat, 0);
  };

  const handleStartTimer = () => {
    setTimerStart(new Date());
    setTimerRunning(true);
    setElapsedSeconds(0);
    setTimerNotes('');
  };

  const handleStopTimer = async () => {
    if (!timerStart) return;

    const endTime = new Date();
    const durationHours = (endTime.getTime() - timerStart.getTime()) / (1000 * 60 * 60);

    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      await api.logTime(jobId, {
        date: timerStart.toISOString().split('T')[0], // YYYY-MM-DD format
        start_time: timerStart.toISOString(),
        end_time: endTime.toISOString(),
        hours: parseFloat(durationHours.toFixed(2)),
        notes: timerNotes || undefined,
      });

      setTimerRunning(false);
      setTimerStart(null);
      setElapsedSeconds(0);
      setTimerNotes('');
      await loadJobDetails(); // Reload job details which includes time entries
      alert('Time logged successfully!');
    } catch (err: any) {
      console.error('Failed to log time:', err);
      alert(err.message || 'Failed to log time. Please try again.');
    }
  };

  const handleSubmitManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualEntry.start_time || !manualEntry.end_time) {
      alert('Please enter both start and end times');
      return;
    }

    const startTime = new Date(manualEntry.start_time);
    const endTime = new Date(manualEntry.end_time);
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    if (durationHours <= 0) {
      alert('End time must be after start time');
      return;
    }

    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      await api.logTime(jobId, {
        date: startTime.toISOString().split('T')[0], // YYYY-MM-DD format
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        hours: parseFloat(durationHours.toFixed(2)),
        notes: manualEntry.notes || undefined,
      });

      setManualEntry({ start_time: '', end_time: '', notes: '' });
      setShowManualEntry(false);
      await loadJobDetails(); // Reload job details which includes time entries
      alert('Time logged successfully!');
    } catch (err: any) {
      console.error('Failed to log time:', err);
      alert(err.message || 'Failed to log time. Please try again.');
    }
  };

  const handleOpenMaterialForm = () => {
    setShowMaterialForm(true);
    if (materialsCatalog.length === 0) {
      loadMaterialsCatalog();
    }
  };

  const handleCloseMaterialForm = () => {
    setShowMaterialForm(false);
    setSearchQuery('');
    setSelectedMaterial(null);
    setUseCustomMaterial(false);
    setFilteredMaterials([]);
    setMaterialForm({
      sku: '',
      name: '',
      description: '',
      quantity: '',
      unit: 'units',
      unit_price_ex_vat: '',
      notes: '',
    });
  };

  const handleSubmitMaterial = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!materialForm.name || !materialForm.quantity || !materialForm.unit_price_ex_vat) {
      alert('Please fill in all required fields');
      return;
    }

    if (!useCustomMaterial && !materialForm.sku) {
      alert('Please select a material from the catalog or use custom material');
      return;
    }

    const quantity = parseFloat(materialForm.quantity);
    const unitPrice = parseFloat(materialForm.unit_price_ex_vat);

    if (quantity <= 0 || unitPrice < 0) {
      alert('Please enter valid quantity and price');
      return;
    }

    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      await api.logMaterial({
        job_id: jobId,
        sku: materialForm.sku || 'CUSTOM',
        name: materialForm.name,
        description: materialForm.description || undefined,
        quantity: quantity,
        unit: materialForm.unit,
        unit_price_ex_vat: unitPrice,
        total_ex_vat: quantity * unitPrice,
        notes: materialForm.notes || undefined,
      });

      handleCloseMaterialForm();
      await loadMaterials();
      alert('Material logged successfully!');
    } catch (err: any) {
      console.error('Failed to log material:', err);
      alert(err.message || 'Failed to log material. Please try again.');
    }
  };

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Job Not Found</h2>
          <p className="text-gray-600 mb-6">The job you're looking for doesn't exist.</p>
          <Link
            href="/jobs"
            className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Jobs
          </Link>
        </div>
      </AppLayout>
    );
  }

  const totalHours = calculateTotalHours();
  const totalMaterialsCost = calculateTotalMaterialsCost();
  const totalVariationsCost = calculateTotalVariationsCost();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <Link
                href="/jobs"
                className="text-gray-400 hover:text-gray-600"
              >
                ← Back
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">{job.job_number}</h1>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(job.status)}`}>
                {job.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-gray-600 mt-1">{job.title}</p>
          </div>

          <div className="flex items-center space-x-3">
            {job.status === 'scheduled' && (
              <button
                onClick={handleStartJob}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Start Job
              </button>
            )}
            {job.status === 'in_progress' && (
              <button
                onClick={handleCompleteJob}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Complete Job
              </button>
            )}
          </div>
        </div>

        {/* Job Details Card */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Client</label>
                <p className="mt-1 text-gray-900">{job.client_name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Site Location</label>
                <p className="mt-1 text-gray-900">{job.site_name || 'N/A'}</p>
                {job.site_address && (
                  <p className="text-sm text-gray-600">{job.site_address}</p>
                )}
              </div>
              {job.description && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="mt-1 text-gray-900">{job.description}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Scheduled Start</label>
                <p className="mt-1 text-gray-900">
                  {job.scheduled_start ? formatDate(job.scheduled_start) : 'Not scheduled'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Scheduled End</label>
                <p className="mt-1 text-gray-900">
                  {job.scheduled_end ? formatDate(job.scheduled_end) : 'Not scheduled'}
                </p>
              </div>
              {job.actual_start && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Actual Start</label>
                  <p className="mt-1 text-gray-900">{formatDate(job.actual_start)}</p>
                </div>
              )}
              {job.actual_end && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Actual End</label>
                  <p className="mt-1 text-gray-900">{formatDate(job.actual_end)}</p>
                </div>
              )}
              {job.estimated_hours && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Estimated Hours</label>
                  <p className="mt-1 text-gray-900">{job.estimated_hours} hours</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-sm text-gray-500">Time Logged</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {totalHours.toFixed(1)} hrs
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Array.isArray(timeEntries) ? timeEntries.length : 0} {Array.isArray(timeEntries) && timeEntries.length === 1 ? 'entry' : 'entries'}
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-sm text-gray-500">Materials Used</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(totalMaterialsCost)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Array.isArray(materials) ? materials.length : 0} {Array.isArray(materials) && materials.length === 1 ? 'item' : 'items'}
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-sm text-gray-500">Variations</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(totalVariationsCost)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Array.isArray(variations) ? variations.length : 0} {Array.isArray(variations) && variations.length === 1 ? 'variation' : 'variations'}
            </div>
          </div>
        </div>

        {/* Time Tracking Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">⏱️ Time Tracking</h2>

          {/* Timer */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Live Timer</h3>
                <p className="text-xs text-gray-600">Track time in real-time</p>
              </div>
              <div className="text-3xl font-mono font-bold text-blue-600">
                {formatElapsedTime(elapsedSeconds)}
              </div>
            </div>

            {timerRunning ? (
              <div className="space-y-3">
                <textarea
                  value={timerNotes}
                  onChange={(e) => setTimerNotes(e.target.value)}
                  placeholder="What work was done? (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={handleStopTimer}
                  className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2"
                >
                  ⏹ Stop Timer & Log Time
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartTimer}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
              >
                ▶️ Start Timer
              </button>
            )}
          </div>

          {/* Manual Entry Toggle */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowManualEntry(!showManualEntry)}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              {showManualEntry ? '✕ Cancel Manual Entry' : '📝 Enter Time Manually'}
            </button>
          </div>

          {/* Manual Entry Form */}
          {showManualEntry && (
            <form onSubmit={handleSubmitManualEntry} className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Manual Time Entry</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={manualEntry.start_time}
                    onChange={(e) => setManualEntry({ ...manualEntry, start_time: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={manualEntry.end_time}
                    onChange={(e) => setManualEntry({ ...manualEntry, end_time: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Work Notes
                </label>
                <textarea
                  value={manualEntry.notes}
                  onChange={(e) => setManualEntry({ ...manualEntry, notes: e.target.value })}
                  placeholder="Describe what work was done during this time..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Log Time Entry
              </button>
            </form>
          )}
        </div>

        {/* Materials Logging Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">📦 Log Materials Used</h2>
              <p className="text-xs text-gray-600 mt-1">Record materials used on this job</p>
            </div>
            <button
              onClick={() => showMaterialForm ? handleCloseMaterialForm() : handleOpenMaterialForm()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
            >
              {showMaterialForm ? '✕ Cancel' : '+ Add Material'}
            </button>
          </div>

          {showMaterialForm && (
            <form onSubmit={handleSubmitMaterial} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              {/* Toggle between catalog and custom */}
              <div className="flex items-center gap-4 pb-3 border-b border-gray-300">
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomMaterial(false);
                    setMaterialForm({
                      sku: '',
                      name: '',
                      description: '',
                      quantity: materialForm.quantity,
                      unit: 'units',
                      unit_price_ex_vat: '',
                      notes: materialForm.notes,
                    });
                    setSearchQuery('');
                    setSelectedMaterial(null);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !useCustomMaterial
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  📦 From Catalog
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomMaterial(true);
                    setMaterialForm({
                      sku: '',
                      name: '',
                      description: '',
                      quantity: materialForm.quantity,
                      unit: 'units',
                      unit_price_ex_vat: '',
                      notes: materialForm.notes,
                    });
                    setSearchQuery('');
                    setSelectedMaterial(null);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    useCustomMaterial
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  ✏️ Custom Material
                </button>
              </div>

              {/* Catalog Material Search */}
              {!useCustomMaterial && (
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Search Material <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleMaterialSearch(e.target.value)}
                    onFocus={() => {
                      if (materialsCatalog.length > 0 && !selectedMaterial) {
                        setFilteredMaterials(materialsCatalog);
                      }
                    }}
                    placeholder="Type to search materials by name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  {filteredMaterials.length > 0 && !selectedMaterial && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredMaterials.slice(0, 10).map((material) => (
                        <button
                          key={material.id}
                          type="button"
                          onClick={() => handleSelectMaterial(material)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-100 last:border-b-0"
                        >
                          <div className="text-sm font-medium text-gray-900">{material.name}</div>
                          {material.description && (
                            <div className="text-xs text-gray-600">{material.description}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            SKU: {material.sku} • {formatCurrency(parseFloat(material.unit_cost || '0'))}/{material.unit || 'unit'}
                          </div>
                        </button>
                      ))}
                      {filteredMaterials.length > 10 && (
                        <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 text-center">
                          Showing 10 of {filteredMaterials.length} results. Keep typing to narrow down...
                        </div>
                      )}
                    </div>
                  )}
                  {selectedMaterial && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium text-green-900">{selectedMaterial.name}</div>
                          <div className="text-xs text-green-700 mt-1">SKU: {selectedMaterial.sku}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMaterial(null);
                            setSearchQuery('');
                            setMaterialForm({
                              ...materialForm,
                              sku: '',
                              name: '',
                              description: '',
                              unit: 'units',
                              unit_price_ex_vat: '',
                            });
                          }}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          ✕ Change
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Start typing the material name to search your catalog
                  </p>
                </div>
              )}

              {/* Custom Material Fields */}
              {useCustomMaterial && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Material Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={materialForm.name}
                      onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                      required
                      placeholder="e.g., 2.5mm T&E Cable"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={materialForm.description}
                      onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                      placeholder="e.g., 2.5mm Twin & Earth Cable, 100m roll"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                </>
              )}

              {/* Common Fields (Quantity, Unit, Price) */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={materialForm.quantity}
                    onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })}
                    required
                    placeholder="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={materialForm.unit}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="units">units</option>
                    <option value="meters">meters</option>
                    <option value="feet">feet</option>
                    <option value="boxes">boxes</option>
                    <option value="rolls">rolls</option>
                    <option value="pieces">pieces</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit Price (£) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={materialForm.unit_price_ex_vat}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit_price_ex_vat: e.target.value })}
                    required
                    placeholder="5.50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              </div>

              {materialForm.quantity && materialForm.unit_price_ex_vat && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Total Cost (ex VAT):</span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCurrency(parseFloat(materialForm.quantity || '0') * parseFloat(materialForm.unit_price_ex_vat || '0'))}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={materialForm.notes}
                  onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                  placeholder="Additional notes about this material..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                Log Material
              </button>
            </form>
          )}
        </div>

        {/* Time Entries */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Time Entries</h2>
            <span className="text-sm text-gray-500">{Array.isArray(timeEntries) ? timeEntries.length : 0} total</span>
          </div>
          {!Array.isArray(timeEntries) || timeEntries.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No time entries logged yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Technician
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Start Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      End Time
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {timeEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.technician_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(entry.start_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {entry.end_time ? formatDate(entry.end_time) : 'In progress'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {entry.hours ? `${parseFloat(entry.hours as any).toFixed(2)} hrs` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {entry.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Materials */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Materials Used</h2>
            <span className="text-sm text-gray-500">{Array.isArray(materials) ? materials.length : 0} items</span>
          </div>
          {!Array.isArray(materials) || materials.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No materials logged yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Logged
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {materials.map((material) => (
                    <tr key={material.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{material.name}</div>
                        {material.description && (
                          <div className="text-xs text-gray-500">{material.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {material.quantity_used || material.quantity} {material.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(parseFloat(material.unit_cost?.toString() || material.unit_price_ex_vat?.toString() || '0'))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(parseFloat(material.total_cost?.toString() || material.total_ex_vat?.toString() || '0'))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(material.created_at || material.logged_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                      Total Materials:
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                      {formatCurrency(totalMaterialsCost)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Variations */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Variations</h2>
            <span className="text-sm text-gray-500">{Array.isArray(variations) ? variations.length : 0} total</span>
          </div>
          {!Array.isArray(variations) || variations.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No variations created yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Variation #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {variations.map((variation) => (
                    <tr key={variation.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {variation.variation_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {variation.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(variation.status)}`}>
                          {variation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(variation.amount_inc_vat)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(variation.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                      Total Variations:
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                      {formatCurrency(totalVariationsCost)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Electrical Tests */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Electrical Tests & Certification</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{Array.isArray(tests) ? tests.length : 0} tests</span>
              {job.electrical_work_type && tests.length === 0 && (
                <button
                  onClick={() => setShowCreateTestModal(true)}
                  className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                >
                  Create Test
                </button>
              )}
            </div>
          </div>
          {!Array.isArray(tests) || tests.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {job.electrical_work_type ? (
                <div>
                  <p className="mb-3">No electrical tests created yet for this job</p>
                  <button
                    onClick={() => setShowCreateTestModal(true)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    Create Electrical Test
                  </button>
                </div>
              ) : (
                'No electrical work specified for this job'
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Test Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Outcome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tests.map((test) => (
                    <tr key={test.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {test.test_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {test.test_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(test.status)}`}>
                          {test.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {test.outcome ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            test.outcome === 'satisfactory' ? 'bg-green-100 text-green-800' :
                            test.outcome === 'unsatisfactory' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {test.outcome.replace('_', ' ')}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {test.completion_date ? formatDate(test.completion_date) :
                         test.test_date ? formatDate(test.test_date) : 'Not scheduled'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/tests/${test.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Test Modal */}
        {job.client_id && job.site_id && (
          <CreateTestModal
            isOpen={showCreateTestModal}
            onClose={() => setShowCreateTestModal(false)}
            jobId={jobId}
            clientId={job.client_id}
            siteId={job.site_id}
            electricalWorkType={job.electrical_work_type}
          />
        )}

        {/* Related Links */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Related</h3>
          <div className="flex gap-3">
            {job.quote_id && (
              <Link
                href={`/quotes/${job.quote_id}`}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                View Original Quote →
              </Link>
            )}
            <Link
              href="/invoices"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View Invoices →
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
