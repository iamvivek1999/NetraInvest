import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { getCampaign } from '../../api/campaigns.api';
import { getMilestones, getCampaignEvidenceStatus, uploadEvidence } from '../../api/milestones.api';
import { ArrowLeft, UploadCloud, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

const MilestoneExecutionPage = () => {
  const { id: campaignId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [files, setFiles] = useState([]);
  const POLYGONSCAN_URL = import.meta.env.VITE_POLYGONSCAN_URL || 'https://amoy.polygonscan.com/tx';

  // Fetch campaign
  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => getCampaign(campaignId),
  });

  // Fetch milestones
  const { data: milestones, isLoading: milestonesLoading } = useQuery({
    queryKey: ['milestones', campaignId],
    queryFn: () => getMilestones(campaignId),
    enabled: !!campaignId
  });

  // Fetch evidence status
  const { data: evidenceState, isLoading: evidenceLoading } = useQuery({
    queryKey: ['campaignEvidence', campaignId],
    queryFn: () => getCampaignEvidenceStatus(campaignId),
    enabled: !!campaignId
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: ({ idx, files }) => uploadEvidence(campaignId, idx, files),
    onSuccess: () => {
      toast.success('Evidence successfully uploaded and is anchoring on-chain!');
      setFiles([]);
      queryClient.invalidateQueries({ queryKey: ['campaignEvidence', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to upload evidence');
    }
  });

  const isLoading = campaignLoading || milestonesLoading || evidenceLoading;

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign || !milestones) {
    return <div className="text-gray-400 p-8">Campaign or milestones not found.</div>;
  }

  const currentIdx = campaign.currentMilestoneIndex || 0;
  const currentMilestone = milestones[currentIdx];
  const ev = evidenceState?.milestones?.find(m => m.milestoneIndex === currentIdx) || {};
  
  // Can submit if administrative status is pending or rejected, 
  // and it hasn't been released on-chain yet.
  const isPending = (['pending', 'rejected'].includes(ev.reviewStatus)) && ev.onChainStatus !== 'released';

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 5) {
      toast.error('Maximum 5 files allowed.');
      return;
    }
    setFiles(selected);
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (files.length === 0) {
      toast.error('Please select files to upload');
      return;
    }
    uploadMutation.mutate({ idx: currentIdx, files });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in">
      <button 
        onClick={() => navigate('/dashboard')}
        className="flex items-center text-sm text-gray-400 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </button>

      <div className="mb-8 p-6 bg-[#1a1a1a] border border-gray-800 rounded-xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">{campaign.title}</h1>
            <p className="text-sm text-gray-400">Manage your milestone execution and submit proof of work to release funds.</p>
          </div>
          <div className="px-4 py-2 bg-[#111] rounded-lg border border-gray-800 text-center">
             <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Funded</div>
             <div className="text-emerald-400 font-medium">{campaign.targetAmount} {campaign.currency}</div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">Milestone Progress</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {milestones.map((ms, idx) => {
          const msEv = evidenceState?.milestones?.find(m => m.milestoneIndex === idx) || {};
          const isCurrent = idx === currentIdx;
          const isPast = idx < currentIdx;
          const statusColors = {
            gray: 'text-gray-500 bg-gray-500/10 border-gray-800',
            blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
            yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
            green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
            red: 'text-red-400 bg-red-500/10 border-red-500/30',
            purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
          };
          const colorClass = statusColors[msEv.stateColor] || statusColors.gray;

          return (
            <div key={idx} className={`p-4 rounded-xl border ${isCurrent ? 'bg-[#1a1a1a] border-emerald-500/50' : 'bg-[#111] border-gray-800'} transition-all`}>
              <div className="flex justify-between items-start mb-2">
                 <div>
                   <div className="text-xs text-gray-500 font-medium uppercase mb-1">Milestone {idx + 1}</div>
                   <div className={`font-semibold ${isCurrent ? 'text-white' : 'text-gray-300'}`}>{ms.title}</div>
                 </div>
                 {isPast ? (
                   <div className="flex flex-col items-end gap-1">
                     <CheckCircle className="w-5 h-5 text-emerald-500" />
                     {msEv.releaseTxHash && (
                       <a 
                         href={`${POLYGONSCAN_URL}/${msEv.releaseTxHash}`} 
                         target="_blank" 
                         rel="noreferrer"
                         className="text-[10px] text-purple-400 hover:underline flex items-center gap-1"
                       >
                         Released <ExternalLink size={10} />
                       </a>
                     )}
                   </div>
                 ) : (
                   <div className="flex flex-col items-end gap-1">
                     <div className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full border ${colorClass}`}>
                       {msEv.stateLabel || 'Pending'}
                     </div>
                     {msEv.submitTxHash && (
                       <a 
                         href={`${POLYGONSCAN_URL}/${msEv.submitTxHash}`} 
                         target="_blank" 
                         rel="noreferrer"
                         className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                       >
                         Evidence Anchored <ExternalLink size={10} />
                       </a>
                     )}
                   </div>
                 )}
              </div>
              <div className="text-sm text-gray-400">{ms.estimatedAmount} {campaign.currency}</div>
            </div>
          );
        })}
      </div>

      {currentMilestone && (
         <div className="p-6 bg-[#1a1a1a] border border-gray-800 rounded-xl">
           <h3 className="text-xl font-bold text-white mb-4">Current: {currentMilestone.title}</h3>
           <p className="text-gray-400 text-sm mb-6 pb-6 border-b border-gray-800">
             {currentMilestone.description}
           </p>

           {!isPending ? (
             <div className="flex flex-col items-center justify-center p-8 text-center bg-[#111] rounded-lg border border-gray-800">
                {ev.reviewStatus === 'approved' ? (
                  <>
                    <CheckCircle className="w-10 h-10 text-emerald-500 mb-4" />
                    <h4 className="text-lg font-semibold text-white mb-2">Evidence Approved!</h4>
                    <p className="text-gray-400 text-sm max-w-sm">
                      Your evidence has been verified. Funds have been approved and will be released following the on-chain confirmation.
                    </p>
                  </>
                ) : (
                  <>
                    <Clock className="w-10 h-10 text-emerald-500 mb-4" />
                    <h4 className="text-lg font-semibold text-white mb-2">Evidence Under Review</h4>
                    <p className="text-gray-400 text-sm max-w-sm">
                      Your uploaded files are being anchored on-chain and reviewed by the administrative team. Funds will be released via the smart contract upon approval.
                    </p>
                  </>
                )}
                
                {ev.reviewStatus === 'rejected' && (
                  <div className="mt-4 p-4 w-full text-left bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm font-semibold mb-1">Upload Rejected:</p>
                    <p className="text-red-300 text-sm">{ev.rejectionReason}</p>
                  </div>
                )}
             </div>
           ) : (
             <form onSubmit={handleUploadSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Upload Financial Evidence
                  </label>
                  <p className="text-xs text-gray-500 mb-4">
                    Please upload supporting documents (PDFs, spreadhseets) detailing your fund usage over this period. These will be reviewed by an AI agent to verify burn-rate before human admins approve your funds release. Max 5 files.
                  </p>
                  
                  <div className="relative border-2 border-dashed border-gray-700 hover:border-emerald-500/50 rounded-xl p-8 bg-[#111] transition-colors group text-center cursor-pointer">
                    <input 
                      type="file" 
                      multiple 
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg"
                    />
                    <UploadCloud className="w-8 h-8 text-gray-500 group-hover:text-emerald-500 mx-auto mb-3 transition-colors" />
                    <div className="text-sm text-gray-400 font-medium">Click to upload or drag and drop</div>
                    <div className="text-xs text-gray-600 mt-1">PDF, CSV, XLSX, JPG (max 20MB)</div>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="mb-6 space-y-2">
                    <div className="text-xs text-gray-400 uppercase font-semibold">Selected Files:</div>
                    {files.map((f, i) => (
                      <div key={i} className="text-sm text-white px-3 py-2 bg-[#222] rounded border border-gray-800 flex justify-between">
                         <span className="truncate">{f.name}</span>
                         <span className="text-gray-500 ml-4">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={uploadMutation.isPending || files.length === 0}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                        Uploading & Anchoring...
                      </>
                    ) : 'Submit Evidence'}
                  </button>
                </div>
             </form>
           )}
         </div>
      )}
    </div>
  );
};

export default MilestoneExecutionPage;
