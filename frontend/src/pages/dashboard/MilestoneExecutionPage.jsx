import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMilestone, submitMilestoneProof } from '../../api/campaigns.api';
import useAuthStore from '../../store/authStore';

// Icons
import {
  ArrowLeft, UploadCloud, FileText, CheckCircle,
  AlertCircle, Clock, Link as LinkIcon
} from 'lucide-react';

const MilestoneExecutionPage = () => {
  const { campaignId, milestoneId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [description, setDescription] = useState('');
  const [proofLinks, setProofLinks] = useState(['']);
  const [documents, setDocuments] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  // Fetch milestone data
  const { data: milestone, isLoading, isError } = useQuery({
    queryKey: ['milestone', campaignId, milestoneId],
    queryFn: () => getMilestone(campaignId, milestoneId),
  });

  const submitProofMutation = useMutation({
    mutationFn: (payload) => submitMilestoneProof(campaignId, milestoneId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['milestone', campaignId, milestoneId]);
      navigate(`/dashboard`);
    },
  });

  // Pre-fill if resubmitting
  useEffect(() => {
    if (milestone?.proofSubmission) {
      if (milestone.status === 'rejected') {
        setDescription(milestone.proofSubmission.description || '');
        setProofLinks(milestone.proofSubmission.proofLinks?.length ? milestone.proofSubmission.proofLinks : ['']);
        setDocuments(milestone.proofSubmission.documents || []);
      }
    }
  }, [milestone]);

  const handleLinkChange = (index, value) => {
    const newLinks = [...proofLinks];
    newLinks[index] = value;
    setProofLinks(newLinks);
  };

  const addLinkField = () => setProofLinks([...proofLinks, '']);
  const removeLinkField = (index) => {
    const newLinks = [...proofLinks];
    newLinks.splice(index, 1);
    setProofLinks(newLinks.length ? newLinks : ['']);
  };

  // Mock file upload wrapper
  const handleFileUpload = (files) => {
    const uploadedDocs = Array.from(files).map((file) => ({
      label: file.name,
      url: URL.createObjectURL(file), // Mock URL
      fileName: file.name,
      fileType: file.type.split('/')[1] || 'unknown',
      fileSize: file.size,
      mimeType: file.type,
      storagePath: `/mock-storage/${file.name}`,
      documentCategory: 'progress evidence',
      uploadedAt: new Date().toISOString()
    }));
    setDocuments((prev) => [...prev, ...uploadedDocs]);
  };

  const onDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const removeDoc = (idx) => {
    const newDocs = [...documents];
    newDocs.splice(idx, 1);
    setDocuments(newDocs);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitProofMutation.mutate({
      description,
      proofLinks: proofLinks.filter(l => l.trim() !== ''),
      documents
    });
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading milestone data...</div>;
  if (isError || !milestone) return <div className="p-8 text-center text-red-500">Error loading milestone.</div>;

  const isEditable = ['pending', 'rejected'].includes(milestone.status);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-sm text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </button>

      <div className="bg-[#111] border border-gray-800 rounded-xl p-6 md:p-8 mb-8 relative overflow-hidden">
        {/* Status Badge */}
        <div className="absolute top-6 right-6">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${milestone.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              milestone.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                milestone.status === 'submitted' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
            {milestone.status.toUpperCase().replace('_', ' ')}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Execute Milestone #{milestone.index + 1}</h1>
        <h2 className="text-xl text-gray-300 mb-6 font-medium">{milestone.title}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fund Allocation</p>
            <p className="text-2xl font-mono text-emerald-400">
              ${milestone.estimatedAmount.toLocaleString()} <span className="text-sm text-gray-500">USDC</span>
            </p>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Target Date</p>
            <p className="text-lg text-white mt-1">
              {milestone.targetDate ? new Date(milestone.targetDate).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6">
          <h3 className="text-sm font-medium text-white mb-2">Milestone Description</h3>
          <p className="text-sm text-gray-400">{milestone.description}</p>
        </div>

        {milestone.status === 'rejected' && milestone.rejectionReason && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400 mb-1">Reviewer Feedback</p>
              <p className="text-sm text-red-300/80">{milestone.rejectionReason}</p>
            </div>
          </div>
        )}
      </div>

      {/* Proof Submission Form */}
      <h2 className="text-xl font-bold text-white mb-6">Execution & Proof</h2>

      {!isEditable ? (
        <div className="bg-[#111] border border-gray-800 rounded-xl p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Proof Submitted</h3>
          <p className="text-gray-400 text-sm">
            Your execution proof is currently marked as <strong className="text-gray-300">{milestone.status}</strong>.
            Modifications are locked while under review.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Notes / Progress Report */}
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Execution Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={5}
              placeholder="Detail the work completed, challenges overcome, and overall progress matching the milestone targets."
              className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none text-white text-sm transition-all"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minLength={20}
            />
          </div>

          {/* Uploads */}
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-4">
              Supporting Documents
            </label>

            {/* Drag Drop Zone */}
            <div
              onDragEnter={onDrag}
              onDragLeave={onDrag}
              onDragOver={onDrag}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive ? 'border-emerald-500 bg-emerald-500/5' : 'border-gray-800 hover:border-gray-700 bg-[#1a1a1a]'
                }`}
            >
              <UploadCloud className="w-10 h-10 text-gray-500 mx-auto mb-4" />
              <p className="text-sm justify-center text-gray-400 mb-2">
                Drag and drop files here, or{' '}
                <label className="text-emerald-400 hover:text-emerald-300 cursor-pointer">
                  browse
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                  />
                </label>
              </p>
              <p className="text-xs text-gray-600">
                Invoices, CSV reports, PDFs, photos (Max 15 files)
              </p>
            </div>

            {/* Document List */}
            {documents.length > 0 && (
              <div className="mt-6 space-y-3">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-200">{doc.fileName}</p>
                        <p className="text-xs text-gray-500">{doc.documentCategory.toUpperCase()} • {(doc.fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDoc(idx)}
                      className="text-gray-500 hover:text-red-400 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Links */}
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-4">
              Evidence Links
            </label>
            <div className="space-y-4">
              {proofLinks.map((link, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="relative flex-grow">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="url"
                      placeholder="https://github.com/..."
                      className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none text-white text-sm"
                      value={link}
                      onChange={(e) => handleLinkChange(idx, e.target.value)}
                    />
                  </div>
                  {proofLinks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLinkField(idx)}
                      className="p-2.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400 rounded-lg"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addLinkField}
                className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
              >
                + Add another link
              </button>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitProofMutation.isPending || !description.trim()}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitProofMutation.isPending ? 'Submitting...' : 'Submit Proof for Review'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MilestoneExecutionPage;
